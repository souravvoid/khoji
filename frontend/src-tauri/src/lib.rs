use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use serde_json::Value;
use tauri::Emitter;

const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "docx", "pptx", "epub", "png", "jpg", "jpeg"];

fn validate_file_path(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let canonical = path.canonicalize().map_err(|_| format!("File not found: {}", file_path))?;
    if !canonical.is_file() {
        return Err(format!("Not a file: {}", file_path));
    }
    let ext = canonical.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("Unsupported file type: .{}", ext));
    }
    Ok(canonical.to_string_lossy().into_owned())
}

struct PythonEngine {
    process: Mutex<Child>,
}

/// Read NDJSON lines from Python stdout until `{"type":"end"}` or `{"type":"error"}`.
/// Calls `on_line` for each line so the caller can emit Tauri events.
fn read_stream<F>(engine: &mut Child, mut on_line: F) -> Result<Value, String>
where
    F: FnMut(&Value),
{
    let stdout = engine.stdout.as_mut().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Read error: {}", e))?;
        if line.trim().is_empty() {
            continue;
        }
        let val: Value = serde_json::from_str(&line)
            .map_err(|e| format!("JSON parse error: {}", e))?;
        let typ = val.get("type").and_then(|v| v.as_str()).unwrap_or("");
        match typ {
            "end" => return Ok(val.get("result").cloned().unwrap_or(Value::Null)),
            "error" => return Err(val.get("error").and_then(|v| v.as_str()).unwrap_or("Stream error").to_string()),
            _ => on_line(&val),
        }
    }
    Err("Stream ended unexpectedly".to_string())
}

fn find_python() -> String {
    for cmd in &["python3", "python"] {
        if let Ok(output) = Command::new(cmd).arg("--version").output() {
            if output.status.success() {
                return cmd.to_string();
            }
        }
    }
    "python3".to_string()
}

fn find_engine_in_mount() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut dir = exe.parent();
    let relative = [
        "backend/python/khoji_engine/main.py",
        "usr/backend/python/khoji_engine/main.py",
        "lib/Khoji/backend/python/khoji_engine/main.py",
    ];
    while let Some(d) = dir {
        for rel in relative.iter() {
            let cand = d.join(rel);
            if cand.exists() {
                return Some(cand);
            }
        }
        dir = d.parent();
    }
    None
}

fn start_python_engine() -> Result<Child, String> {
    let python = find_python();
    let cwd = std::env::current_dir().unwrap_or_default();

    let appimage_path = std::env::current_exe().ok()
        .and_then(|p| p.parent().map(|p| {
            p.join("../lib/Khoji/backend/python/khoji_engine/main.py")
        }));

    let candidates = vec![
        Some(cwd.join("../../backend/python/khoji_engine/main.py")),
        cwd.parent().map(|p| p.join("backend/python/khoji_engine/main.py")),
        Some(cwd.join("../../../backend/python/khoji_engine/main.py")),
        appimage_path,
        std::env::var("KHOJI_ENGINE").ok().map(|p| {
            let path = std::path::PathBuf::from(&p);
            if path.is_dir() { path.join("khoji_engine/main.py") } else { path }
        }),
        Some(cwd.join("khoji_engine/main.py")),
        find_engine_in_mount(),
    ];

    let engine_script = candidates
        .into_iter()
        .flatten()
        .find(|p| p.exists())
        .ok_or_else(|| "Engine script not found".to_string())?;

    let engine_dir = engine_script
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| "Cannot determine engine directory".to_string())?;

    eprintln!("[khoji] Starting Python engine from: {:?}", engine_dir);
    eprintln!("[khoji] Python: {} -m khoji_engine.main", python);

    let mut cmd = Command::new(&python);
    cmd.args(["-v", "-m", "khoji_engine.main"])
        .current_dir(engine_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Remove all env vars that could interfere with Python's stdlib discovery
    for var in ["LD_LIBRARY_PATH", "PYTHONHOME", "PYTHONPATH", "PYTHONSTARTUP", "APPIMAGE", "APPDIR"] {
        cmd.env_remove(var);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to start Python engine: {}", e))?;

    let stderr = child.stderr.take().ok_or("No stderr")?;
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[python] {}", line);
            }
        }
    });

    let stdout = child.stdout.as_mut().ok_or("No stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut ready_line = String::new();
    reader
        .read_line(&mut ready_line)
        .map_err(|e| format!("Failed to read engine ready message: {}", e))?;
    eprintln!("[khoji] Engine ready: {}", ready_line.trim());

    Ok(child)
}

fn check_engine_alive(engine: &mut Child) -> Result<(), String> {
    match engine.try_wait() {
        Ok(Some(status)) => Err(format!(
            "Python engine exited (status: {}) — restart the app",
            status
        )),
        Err(e) => Err(format!("Failed to check engine status: {}", e)),
        Ok(None) => Ok(()),
    }
}

fn send_message(engine: &mut Child, message: &str) -> Result<String, String> {
    check_engine_alive(engine)?;

    let stdin = engine.stdin.as_mut().ok_or("No stdin")?;
    let stdout = engine.stdout.as_mut().ok_or("No stdout")?;

    writeln!(stdin, "{}", message)
        .map_err(|e| format!("Write error (broken pipe — engine crashed): {}", e))?;

    let mut reader = BufReader::new(stdout);
    let mut response = String::new();
    reader
        .read_line(&mut response)
        .map_err(|e| format!("Read error: {}", e))?;

    Ok(response.trim().to_string())
}

/// Streamed chat — emits `stream-token` events for each token, then returns the full response.
#[tauri::command]
fn ask_ai_stream(
    app: tauri::AppHandle,
    state: tauri::State<PythonEngine>,
    doc_id: String,
    message: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "chat_stream",
        "payload": { "doc_id": doc_id, "message": message }
    });
    writeln!(engine.stdin.as_mut().ok_or("No stdin")?, "{}", msg)
        .map_err(|e| format!("Write error: {}", e))?;

    let app_clone = app.clone();
    let result = read_stream(&mut engine, |val| {
        if let Some(content) = val.get("content").and_then(|v| v.as_str()) {
            let _ = app_clone.emit("stream-token", content.to_string());
        }
    })?;

    Ok(serde_json::to_string(&result).unwrap_or_default())
}

/// Streamed document processing — emits `progress-update` events for each stage.
/// Returns the final result payload from Python.
#[tauri::command]
fn process_document_stream(
    app: tauri::AppHandle,
    state: tauri::State<PythonEngine>,
    file_path: String,
) -> Result<String, String> {
    let safe_path = validate_file_path(&file_path)?;
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "process_document_stream",
        "payload": { "file_path": safe_path }
    });
    writeln!(engine.stdin.as_mut().ok_or("No stdin")?, "{}", msg)
        .map_err(|e| format!("Write error: {}", e))?;

    let app_clone = app.clone();
    let result = read_stream(&mut engine, |val| {
        if let Some(stage) = val.get("stage").and_then(|v| v.as_str()) {
            let pct = val.get("pct").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let _ = app_clone.emit("progress-update", serde_json::json!({"stage": stage, "pct": pct}));
        }
    })?;

    Ok(serde_json::to_string(&result).unwrap_or_default())
}

#[tauri::command]
fn process_document(state: tauri::State<PythonEngine>, file_path: String) -> Result<String, String> {
    let safe_path = validate_file_path(&file_path)?;
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "process_document",
        "payload": { "file_path": safe_path }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn search_documents(
    state: tauri::State<PythonEngine>,
    query: String,
    limit: Option<usize>,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "search",
        "payload": { "query": query, "limit": limit.unwrap_or(10) }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn ask_ai(
    state: tauri::State<PythonEngine>,
    doc_id: String,
    message: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "chat",
        "payload": { "doc_id": doc_id, "message": message }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn generate_flashcards(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "generate_flashcards",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn generate_quiz(
    state: tauri::State<PythonEngine>,
    doc_id: String,
    count: Option<usize>,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "generate_quiz",
        "payload": { "doc_id": doc_id, "count": count.unwrap_or(10) }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn get_documents(state: tauri::State<PythonEngine>) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "get_documents",
        "payload": {}
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn get_document(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "get_document",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn delete_document(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "delete_document",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn export_document(
    state: tauri::State<PythonEngine>,
    doc_id: String,
    format: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "export_document",
        "payload": { "doc_id": doc_id, "format": format }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn get_models(state: tauri::State<PythonEngine>) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "get_models",
        "payload": {}
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn get_chat_history(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "get_chat_history",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn download_model(state: tauri::State<PythonEngine>, model_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "download_model",
        "payload": { "model_id": model_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn check_processing_status(
    state: tauri::State<PythonEngine>,
    doc_id: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "check_processing_status",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn get_processing_progress(
    state: tauri::State<PythonEngine>,
    doc_id: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "get_processing_progress",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn generate_timeline(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "generate_timeline",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn generate_mindmap(state: tauri::State<PythonEngine>, doc_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "generate_mindmap",
        "payload": { "doc_id": doc_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn select_model(state: tauri::State<PythonEngine>, model_id: String) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "select_model",
        "payload": { "model_id": model_id }
    });
    send_message(&mut engine, &msg.to_string())
}

#[tauri::command]
fn save_notes(
    state: tauri::State<PythonEngine>,
    doc_id: String,
    content: String,
) -> Result<String, String> {
    let mut engine = state.process.lock().map_err(|e| e.to_string())?;
    let msg = serde_json::json!({
        "action": "save_notes",
        "payload": { "doc_id": doc_id, "content": content }
    });
    send_message(&mut engine, &msg.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = start_python_engine().expect("Failed to start Python AI engine");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PythonEngine {
            process: Mutex::new(engine),
        })
        .invoke_handler(tauri::generate_handler![
            process_document,
            process_document_stream,
            search_documents,
            ask_ai,
            ask_ai_stream,
            generate_flashcards,
            generate_quiz,
            get_documents,
            get_document,
            delete_document,
            export_document,
            get_models,
            get_chat_history,
            download_model,
            check_processing_status,
            get_processing_progress,
            generate_timeline,
            generate_mindmap,
            save_notes,
            select_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

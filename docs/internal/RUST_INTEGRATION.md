# Rust/Tauri Integration

## Overview

The Rust layer (`frontend/src-tauri/`) is a **thin transport shell** between the React frontend and the Python AI engine. It owns no business logic — its sole responsibilities are:

1. Spawning and managing the Python process
2. Validating file paths (security)
3. Serializing/deserializing JSON messages
4. Providing native OS file dialogs
5. Managing the application window

## Entry Points

### `main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    khoji_lib::run()
}
```

Minimal shim. Hides console on Windows release builds.

### `lib.rs::run()`

```rust
pub fn run() {
    let child = start_python_engine().expect("Failed to start Python engine");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PythonEngine { process: Mutex::new(child) })
        .invoke_handler(tauri::generate_handler![
            process_document,
            search_documents,
            ask_ai,
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
        .expect("Failed to run Tauri app");
}
```

## Python Process Management

### `start_python_engine()` (line 60-127)

**Step 1: Find Python**
```rust
// Probes python3 and python via --version
let python = Command::new("python3")
    .arg("--version")
    .output()
    .map(|o| o.status.success())
    .unwrap_or(false);
// Falls back to "python" if "python3" fails
```

**Step 2: Resolve engine path**

Tries 7 candidate paths:
```
../../backend/python/khoji_engine/main.py
../backend/python/khoji_engine/main.py
../../../backend/python/khoji_engine/main.py
<exe_dir>/../lib/Khoji/backend/python/khoji_engine/main.py  (AppImage)
$KHOJI_ENGINE                                               (env var)
./khoji_engine/main.py
<exe_dir>/../.../backend/python/khoji_engine/main.py       (recursive)
```

**Step 3: Spawn process**
```rust
Command::new(python)
    .arg("-v")
    .arg("-m")
    .arg("khoji_engine.main")
    .current_dir(engine_parent_dir)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .env_clear()  // Clean environment
    .env("HOME", home_dir)
    .spawn()
```

**Important**: `env_clear()` removes `LD_LIBRARY_PATH`, `PYTHONHOME`, `PYTHONPATH`, `PYTHONSTARTUP`, `APPIMAGE`, `APPDIR` to prevent Python stdlib conflicts in AppImage context.

**Step 4: Handshake**
```rust
// Reads first line from stdout
let mut reader = BufReader::new(child.stdout.take().unwrap());
let mut handshake = String::new();
reader.read_line(&mut handshake)?;
// Expected: {"type":"ready","version":"1.0.0"}
```

**Step 5: Background stderr drain**
```rust
std::thread::spawn(move || {
    let mut stderr = BufReader::new(child.stderr.take().unwrap());
    let mut line = String::new();
    while stderr.read_line(&mut line).is_ok() {
        eprintln!("[python] {}", line.trim());
        line.clear();
    }
});
```

## JSON Bridge Protocol

### `send_message()` (line 140-156)

```rust
fn send_message(engine: &State<PythonEngine>, message: &str) -> Result<String, String> {
    // 1. Check if Python process is alive
    let mut process = engine.process.lock().map_err(|e| e.to_string())?;
    if let Some(status) = process.try_wait().map_err(|e| e.to_string())? {
        return Err("Python engine process has exited".to_string());
    }
    
    // 2. Write to stdin
    let stdin = process.stdin.as_mut().ok_or("Failed to access stdin")?;
    stdin.write_all(message.as_bytes()).map_err(|e| e.to_string())?;
    stdin.write_all(b"\n").map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;
    
    // 3. Read from stdout
    let stdout = process.stdout.as_mut().ok_or("Failed to access stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut response = String::new();
    reader.read_line(&mut response).map_err(|e| e.to_string())?;
    
    Ok(response.trim().to_string())
}
```

### Serialization

Every command:
1. Receives typed parameters from Tauri
2. Serializes to JSON: `{"action":"action_name","payload":{...}}`
3. Sends via `send_message()`
4. Receives JSON response string
5. Returns `Result<String, String>` to frontend

The frontend's `parseResponse()` unwraps the `{ result: T }` envelope.

## All 18 Tauri Commands

Every command follows the same pattern:

```rust
#[tauri::command]
fn command_name(
    param: String,
    engine: State<PythonEngine>
) -> Result<String, String> {
    let message = serde_json::json!({
        "action": "action_name",
        "payload": { "param": param }
    }).to_string();
    send_message(&engine, &message)
}
```

### Commands with Rust-Side Logic

Only `process_document` has Rust-side validation:

```rust
#[tauri::command]
fn process_document(file_path: String, engine: State<PythonEngine>) -> Result<String, String> {
    let canonical = validate_file_path(&file_path)?;
    let message = serde_json::json!({
        "action": "process_document",
        "payload": { "file_path": canonical }
    }).to_string();
    send_message(&engine, &message)
}

fn validate_file_path(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path).canonicalize().map_err(|e| e.to_string())?;
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ALLOWED_EXTENSIONS.contains(&ext) => Ok(path.to_string_lossy().to_string()),
        _ => Err("Unsupported file type".to_string()),
    }
}
```

**ALLOWED_EXTENSIONS**: `["pdf", "docx", "pptx", "epub", "png", "jpg", "jpeg"]`

### Commands Without Rust Logic (Pass-through)

17 commands are pure pass-through — they serialize JSON and forward to Python:

```rust
#[tauri::command]
fn search_documents(query: String, limit: Option<usize>, engine: State<PythonEngine>) -> Result<String, String> {
    let message = serde_json::json!({
        "action": "search",
        "payload": { "query": query, "limit": limit.unwrap_or(10) }
    }).to_string();
    send_message(&engine, &message)
}
```

## Tauri Plugins

### tauri-plugin-dialog v2

**Purpose**: Native OS file dialogs (open/save).

**Registration**:
```rust
.plugin(tauri_plugin_dialog::init())
```

**Capabilities**: `"dialog:default"` permission in `capabilities/default.json`.

**Usage in frontend**:
```typescript
import { open } from '@tauri-apps/plugin-dialog';
const path = await open({ multiple: false, filters: [{ name: 'Documents', extensions: ['pdf', 'docx', ...] }] });
```

**No other plugins** — no filesystem, HTTP, shell, or path plugins. All file access is proxied through Rust commands.

## Window Configuration

```json
{
  "title": "Khoji - Offline AI Knowledge Workspace",
  "width": 1280,
  "height": 800,
  "minWidth": 900,
  "minHeight": 600,
  "resizable": true,
  "fullscreen": false,
  "center": true
}
```

Single window. No tray icon. No multi-window. No custom titlebar.

## Security Model

### Capabilities

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["core:default", "dialog:default"]
}
```

- **core:default**: Standard Tauri permissions (invoke commands, basic window ops)
- **dialog:default**: File open/save dialogs
- **No fs:http:shell:path permissions** — frontend has zero direct filesystem or network access

### CSP

`"csp": null` — Content Security Policy is disabled. The WebView has no restrictions on what scripts can load.

### File Path Validation

Only `process_document` validates paths:
1. Canonicalize (resolve symlinks, normalize)
2. Confirm it's a file
3. Check extension whitelist

Other commands pass doc_id strings — no path validation needed.

## Bundle Configuration

```json
{
  "active": true,
  "targets": "all",
  "icon": ["32x32.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico"]
}
```

- **targets: "all"**: Builds .deb, .AppImage (Linux), .msi/.exe (Windows), .dmg (macOS)
- 18 icon files for all platforms
- **No externalBin** — Python engine is NOT bundled; discovered at runtime

## Concurrency Model

The `Mutex<Child>` means commands are **serialized** — only one Rust command can talk to Python at a time.

**Impact**: A long-running `process_document` (e.g., large PDF) blocks all other commands for the duration. The frontend must wait.

**No streaming**: Every command sends one JSON, reads one JSON back. No SSE, no progress callbacks. Frontend polls `get_processing_progress` for status.

## Error Propagation

All errors become `Result<String, String>`:
- `Ok(String)` — JSON response from Python
- `Err(String)` — Error message

No typed errors, no error codes. The frontend receives raw JSON strings and parses them.

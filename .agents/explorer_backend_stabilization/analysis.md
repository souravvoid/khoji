# Codebase Exploration Report: Backend Stabilization

This report documents the exploration of the Khoji application, specifically analyzing the backend subprocess orchestration, IPC layer, database structure, and the 16 IPC commands.

---

## 1. Frontend Directory References in Scripts

In the project workspace, there are two frontend directories:
- `frontend/`: Contains only `src-tauri` directory structure (empty of source files).
- `frontend1/`: Contains the actual React/Tite/Tauri application, including `package.json`, `src/`, config files, etc.

Both `scripts/run-dev.sh` and `scripts/build-linux.sh` incorrectly reference the `frontend/` directory instead of the active `frontend1/` directory.

### `scripts/run-dev.sh` References
* **Line 32-37**: Checks for dependencies and runs installer inside `frontend/` instead of `frontend1/`.
  ```bash
  if [ ! -d "frontend/node_modules" ]; then
      echo ">>> Installing frontend dependencies..."
      cd frontend
      npm install
      cd "$ROOT"
  fi
  ```
* **Line 44-45**: Starts Tauri dev server inside `frontend/` instead of `frontend1/`.
  ```bash
  cd frontend
  npx tauri dev
  ```

### `scripts/build-linux.sh` References
* **Line 12-16**: Builds the frontend inside `frontend/` instead of `frontend1/`.
  ```bash
  cd frontend
  npm ci 2>/dev/null || npm install
  npm run build
  echo "  ✓ Frontend built: dist/"
  cd "$ROOT"
  ```
* **Line 20-25**: Triggers the Tauri AppImage bundle compile inside `frontend/` instead of `frontend1/`.
  ```bash
  cd frontend
  npx tauri build --bundles appimage 2>&1 || { ... }
  ```
* **Line 30-33**: Copies build output AppImage from the Tauri target release folder inside `frontend/` instead of `frontend1/`.
  ```bash
  if [ -f frontend/src-tauri/target/release/bundle/appimage/*.AppImage ]; then
      cp frontend/src-tauri/target/release/bundle/appimage/*.AppImage dist/
      echo "  ✓ AppImage copied to dist/"
  fi
  ```

**Impact:** Running either script in their current form will fail since `frontend/` lacks a `package.json` file and other necessary assets. These references need to be updated to `frontend1/`.

---

## 2. Embedding Model Initialization and Loading

### Location of `get_embedder()`
The `get_embedder()` function is defined in `backend/python/khoji_engine/ai/embeddings.py` (lines 81-85). It is **not** defined directly in `backend/python/khoji_engine/main.py`, but it is transitively used by the pipeline modules imported in `main.py`.

### How it Works
The embedding pipeline uses the `all-MiniLM-L6-v2` model from `sentence-transformers` (generating 384-dimensional dense vectors).

1. **Singleton Pattern**:
   A module-level global variable `_default_embedder` holds a cached instance of the `Embedder` class.
   ```python
   _default_embedder: Embedder | None = None

   def get_embedder() -> Embedder:
       global _default_embedder
       if _default_embedder is None:
           _default_embedder = Embedder()
       return _default_embedder
   ```
2. **Lazy Loading**:
   Instantiating `Embedder()` via `get_embedder()` is cheap because the constructor only sets up the initial empty state:
   ```python
   def __init__(self) -> None:
       self.state = EmbeddingState()
       self._model = None
   ```
   The model is loaded lazily on the first invocation of `.embed()` or `.embed_one()` by calling `self.load()`:
   ```python
   def load(self) -> bool:
       if self._model is not None:
           return True
       try:
           from sentence_transformers import SentenceTransformer
           self._model = SentenceTransformer(MODEL_NAME)
           self.state.loaded = True
           self.state.model_name = MODEL_NAME
           return True
       except Exception as e:
           ...
   ```
3. **Usage in Pipeline**:
   - In `main.py`, the `search` action calls `get_vector_store().search()`. Inside `vector_search.py`, `get_embedder()` is called to retrieve the embedder and embed the query.
   - The `process_document` action calls `process_document_sync()`. Inside `processor.py`, `get_embedder()` is called to embed text chunks during the pipeline.

---

## 3. IPC Handlers Setup and Calling Flow

The Tauri-Rust application and the Python AI Engine communicate using **JSON lines over standard input (stdin) and standard output (stdout)**.

### Rust Side Setup (`frontend1/src-tauri/src/lib.rs`)
1. **Engine Process Lifecycle**:
   At application startup, `run()` calls `start_python_engine()` which locates and spawns the Python subprocess pointing to `backend/python/khoji_engine/main.py`:
   ```rust
   let child = Command::new(&python)
       .arg(&engine_script)
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .spawn()?;
   ```
2. **State Management**:
   The spawned child process is stored in a Mutex wrapper struct `PythonEngine` and registered as Tauri global state:
   ```rust
   struct PythonEngine {
       process: Mutex<Child>,
   }
   // ...
   tauri::Builder::default().manage(PythonEngine { process: Mutex::new(engine) })
   ```
3. **Command Invocation**:
   Tauri command handlers (annotated with `#[tauri::command]`) lock the engine mutex, serialize the target action and parameters as a JSON string, and call the helper `send_message()`:
   ```rust
   fn send_message(engine: &mut Child, message: &str) -> Result<String, String> {
       let stdin = engine.stdin.as_mut().ok_or("No stdin")?;
       let stdout = engine.stdout.as_mut().ok_or("No stdout")?;
       writeln!(stdin, "{}", message)?;
       let mut reader = BufReader::new(stdout);
       let mut response = String::new();
       reader.read_line(&mut response)?;
       Ok(response.trim().to_string())
   }
   ```

### Python Side Setup (`backend/python/khoji_engine/main.py`)
1. **Ready Handshake**:
   Upon launch, `main()` prints a ready JSON payload to notify the Rust side:
   ```python
   sys.stdout.write(json.dumps({"type": "ready", "version": "1.0.0"}) + "\n")
   sys.stdout.flush()
   ```
2. **IPC Loop**:
   The engine spins in a blocking loop reading line-by-line from `sys.stdin`:
   ```python
   for line in sys.stdin:
       # Parse JSON line
       msg = json.loads(line)
       # Route to handler
       response = handle_message(msg)
       # Write JSON reply to stdout
       sys.stdout.write(json.dumps(response) + "\n")
       sys.stdout.flush()
   ```
3. **Action Routing**:
   The `handle_message(msg)` function maps the `action` string through an `if/elif` block to run the corresponding module logic and returns a status dictionary.

---

## 4. Database Class Structure and Schema

The `Database` class is defined in `backend/python/khoji_engine/database/db.py`.

### SQLite Connection & Configuration
The database connection is opened in `_connect(db_path: Path)` with critical configuration options to support concurrency and safety:
- `check_same_thread=False`: Allows sharing the SQLite connection object across threads.
- `PRAGMA journal_mode=WAL`: Write-Ahead Logging enables concurrent readers without blocking writes.
- `PRAGMA foreign_keys=ON`: Enforces referential integrity.
- `PRAGMA busy_timeout=5000`: Sets a 5-second lock timeout to prevent database locked exceptions.

### Table Schema
The DB schema comprises 6 primary tables:
1. `documents`: Metadata, file status (`status`), and file paths.
2. `document_chunks`: Extracted text chunks with character offsets.
3. `notes`: Document summaries/markdown notes.
4. `flashcards`: Spaced repetition items with ease factor, interval, and next review timestamp.
5. `quiz_questions`: Generated MCQ quiz options and explanations.
6. `chat_sessions` & `chat_messages`: Conversation historical logs.

### Analysis of Target Database Methods
1. **`upsert_notes`**: **Already exists** in `Database` (lines 144-157). It inserts a new markdown record or updates an existing note matching the `document_id`.
2. **`save_notes`**: **Does not exist** in `Database`. It is not defined, but the same logic is fully addressed by `upsert_notes()`.
3. **`create_chat_session`**: **Already exists** in `Database` (lines 276-284). It creates and returns a new session entry.
4. **`add_chat_message`**: **Already exists** in `Database` (lines 299-308). It inserts a chat history message and updates the session's `updated_at` timestamp.

---

## 5. IPC Actions Catalogue & Analysis

Here is the comprehensive audit of the 16 IPC actions exposed via Rust-Tauri command handlers.

| # | Tauri Command | Action in Python | Purpose | Expected Inputs |
|---|---|---|---|---|
| 1 | `process_document` | `"process_document"` | Runs document text extraction (RapidOCR/Tesseract fallback), chunking, notes generation, embedding generation, and flashcard/quiz creation. | `file_path`: String (Absolute path to supported PDF/DOCX/PPTX/EPUB/Image). |
| 2 | `search_documents` | `"search"` | Executes query embedding and returns top-k nearest neighbor semantic text chunks using FAISS. | `query`: String, `limit`: Option<usize> (default 10). |
| 3 | `ask_ai` | `"chat"` | RAG QA chat. Fetches notes context, appends user message, and sends query to local GGUF model. | `doc_id`: String, `message`: String. |
| 4 | `generate_flashcards` | `"generate_flashcards"` | Generates definition-based study cards from document text using regex heuristics. | `doc_id`: String. |
| 5 | `generate_quiz` | `"generate_quiz"` | Generates multiple-choice quiz questions from document definitions. | `doc_id`: String, `count`: Option<usize> (default 10). |
| 6 | `get_documents` | `"get_documents"` | Lists all registered documents in the SQLite database. | None. |
| 7 | `get_document` | `"get_document"` | Fetches full document object, including embedded notes, flashcards, and quizzes. | `doc_id`: String. |
| 8 | `delete_document` | `"delete_document"` | Removes document metadata, chunks, notes, cards, and quizzes from SQLite. | `doc_id`: String. |
| 9 | `export_document` | `"export_document"` | Serializes document content/notes/flashcards into target formats. | `doc_id`: String, `format`: String (`"markdown"`, `"html"`, `"json"`, `"anki"`, `"quiz_json"`, `"flashcards_json"`, `"mermaid"`, `"csv"`). |
| 10 | `get_models` | `"get_models"` | Lists local GGUF model presets and sizes. | None. |
| 11 | `get_chat_history` | `"get_chat_history"` | Fetches all chat sessions and their messages associated with a document. | `doc_id`: String. |
| 12 | `download_model` | `"download_model"` | Triggers direct HTTP download of selected GGUF model file into target models directory. | `model_id`: String (`"qwen2.5-0.5b"`, `"qwen2.5-1.5b"`, `"smollm2-1.7b"`, `"tinyllama-1.1b"`). |
| 13 | `check_processing_status` | `"check_processing_status"`| Inspects the database `status` column for a document. | `doc_id`: String. |
| 14 | `get_processing_progress` | `"get_processing_progress"`| Estimates pipeline progress as an integer. | `doc_id`: String. |
| 15 | `generate_timeline` | `"generate_timeline"` | Extracts date-specific sentences and generates chronological list. | `doc_id`: String. |
| 16 | `generate_mindmap` | `"generate_mindmap"` | Generates a Mermaid tree string based on document headings hierarchy. | `doc_id`: String. |

---

### Detailed Analysis and Gaps Identified Per Action

#### 1. `process_document`
* **Python Handler**: Imports `process_document_sync(file_path)` which runs everything synchronously.
* **Gaps/Bugs**:
  - The model warm-up step for sentence-transformers takes ~60 seconds on the first processed file, blocking the main IPC thread. No async feedback is returned to the frontend.
  - The progress callback inside `processor.py` (e.g. `progress_callback("chunking", 55)`) is not wired back to Tauri. The frontend shows 0% then jumps to 100% because the connection is synchronously waiting on standard output.

#### 2. `search_documents`
* **Python Handler**: Calls `get_vector_store().search()`.
* **Gaps/Bugs**:
  - While the backend is fully functional, the React frontend (`SearchModal`) is currently hardcoded to only perform client-side string filtering on title fields. The semantic search query handler is completely unused by the UI.

#### 3. `ask_ai`
* **Python Handler**: Runs RAG generation. Takes the first 2000 characters of `notes` content as context and sends the query to the local LLM.
* **Gaps/Bugs**:
  - The chat message is NOT saved to the database. The frontend makes this call, but the chat history is not persisted across page reloads.
  - Inference is fully synchronous; there is no token-by-token streaming, making the UI appear frozen during the 10-30s inference time.

#### 4. `generate_flashcards` & 5. `generate_quiz`
* **Python Handler**: Calls pipeline generators and persists the results.
* **Gaps/Bugs**:
  - Rule-based regex parser. Very high dependency on clean document formatting.

#### 8. `delete_document`
* **Python Handler**: Deletes the document from the SQLite database.
* **Gaps/Bugs**:
  - Deleting the document in SQLite fails to delete the corresponding vector embeddings from the FAISS index file (`index.faiss`), causing the index to grow stale and retain dead vectors.

#### 10. `get_models`
* **Python Handler**: Hardcodes the return status of all model presets to `"not-installed"`.
* **Gaps/Bugs**:
  - It does not check if the model GGUF file already exists in `~/.khoji/models/`. Even if the model has been downloaded, it will report `"not-installed"`.

#### 12. `download_model`
* **Python Handler**: Calls `LocalLLM.ensure_model()` which downloads the GGUF file via blocking `urllib.request.urlretrieve`.
* **Gaps/Bugs**:
  - This freezes the entire subprocess. Since it is run synchronously in the IPC thread, no other commands (such as a status query) can be processed, causing the app to hang until the download completes.

#### 14. `get_processing_progress`
* **Python Handler**: Maps the document status to progress integers.
  ```python
  progress_map = {"pending": 0, "processing": 50, "completed": 100, "failed": 0}
  ```
* **Gaps/Bugs**:
  - Mismatch in status naming: `process_document_sync` updates document status to `"ready"` when completed (line 162 in `processor.py`). However, the `progress_map` checks for `"completed"`.
  - As a result, when a document is successfully processed, `get_processing_progress` looks up `"ready"` in `progress_map` (which is not present) and defaults to `0`, leading the UI to report that the progress is 0% even though processing succeeded.

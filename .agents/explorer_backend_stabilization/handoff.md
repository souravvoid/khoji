# Handoff Report - Backend Stabilization Exploration

This report summarizes the findings of the codebase exploration regarding build scripts, embedding model initialization, IPC mechanism, database structures, and the 16 IPC commands.

---

## 1. Observation

### Frontend Directory References in Scripts
We observed that all build and development runner scripts reference `frontend/` instead of `frontend1/`.
* `scripts/run-dev.sh`:
  - Line 32-37:
    ```bash
    if [ ! -d "frontend/node_modules" ]; then
        echo ">>> Installing frontend dependencies..."
        cd frontend
        npm install
        cd "$ROOT"
    fi
    ```
  - Line 44-45:
    ```bash
    cd frontend
    npx tauri dev
    ```
* `scripts/build-linux.sh`:
  - Line 12-16:
    ```bash
    cd frontend
    npm ci 2>/dev/null || npm install
    npm run build
    ```
  - Line 20-21:
    ```bash
    cd frontend
    npx tauri build --bundles appimage 2>&1
    ```
  - Line 30-31:
    ```bash
    if [ -f frontend/src-tauri/target/release/bundle/appimage/*.AppImage ]; then
        cp frontend/src-tauri/target/release/bundle/appimage/*.AppImage dist/
    ```

However, running `list_dir` on the project root reveals:
* `frontend/`: Contains only `src-tauri` directory structure (empty).
* `frontend1/`: Contains the complete React application (`package.json`, `src/`, config files).

### Embedding Model Initialization
We observed that `get_embedder()` is located in `backend/python/khoji_engine/ai/embeddings.py` on line 81:
```python
_default_embedder: Embedder | None = None

def get_embedder() -> Embedder:
    global _default_embedder
    if _default_embedder is None:
        _default_embedder = Embedder()
    return _default_embedder
```
The model `all-MiniLM-L6-v2` is loaded lazily inside the `load()` method of `Embedder` when `.embed()` or `.embed_one()` is called.

### IPC Layer Setup
We observed the Rust command handlers in `frontend1/src-tauri/src/lib.rs` (lines 67-226) mapping Tauri commands to JSON payloads written to the stdin stream of the Python subprocess:
- Rust side (`lib.rs` line 228-255) registers exactly 16 commands: `process_document`, `search_documents`, `ask_ai`, `generate_flashcards`, `generate_quiz`, `get_documents`, `get_document`, `delete_document`, `export_document`, `get_models`, `get_chat_history`, `download_model`, `check_processing_status`, `get_processing_progress`, `generate_timeline`, and `generate_mindmap`.
- Python side (`main.py` line 228-249) reads JSON from `sys.stdin` line by line, invokes `handle_message()`, and responds by writing the serialized result JSON back to `sys.stdout`.

### Database Structure
We observed `Database` class methods in `backend/python/khoji_engine/database/db.py`:
- `upsert_notes` exists (lines 144-157).
- `save_notes` does not exist.
- `create_chat_session` exists (lines 276-284).
- `add_chat_message` exists (lines 299-308).
- SQLite connection options configured in `_connect(db_path)` (lines 31-38): row factory set to `sqlite3.Row`, journal mode `WAL`, foreign keys `ON`, busy timeout `5000`.

### Gaps and Bugs in Actions
- `get_processing_progress` (main.py lines 192-202) checks a progress map:
  ```python
  progress_map = {"pending": 0, "processing": 50, "completed": 100, "failed": 0}
  ```
  However, `processor.py` (line 162) updates status to `"ready"`. When `"ready"` is queried, it falls back to `0`, making completed documents display 0% progress.
- `delete_document` (main.py lines 115-120) calls `db.delete_document()`, which removes DB rows, but it does NOT remove vector embeddings from the FAISS vector index.
- `get_models` (main.py lines 131-144) hardcodes `"status": "not-installed"` for all models, ignoring if GGUF files exist in `~/.khoji/models/`.
- `download_model` (main.py lines 174-182) performs a blocking `urllib.request.urlretrieve` inside the synchronous IPC thread.

---

## 2. Logic Chain

1. **Frontend directory mismatch**: Since `frontend1/` contains the actual frontend code and configuration while `frontend/` is empty, running `scripts/run-dev.sh` or `scripts/build-linux.sh` directly will fail with errors about missing packages or files.
2. **Embedding Model Initialization**: The `get_embedder()` function returns a cached singleton `Embedder` instance. The embedding model is loaded lazily on the first invocation, leading to a long delay (~60 seconds) during the first document processing or semantic search action.
3. **Database Methods Presence**: The database structure contains all required methods for chat sessions and document chunk management. Although `save_notes` is missing, `upsert_notes` implements the equivalent functionality.
4. **IPC progress bug**: The `get_processing_progress` action maps document status to progress using a dictionary. Since `processor.py` writes `"ready"` but `get_processing_progress` checks for `"completed"`, the progress returns `0` instead of `100` upon completion.
5. **IPC blocking download**: The `download_model` action runs synchronously inside the message loop. Because it is synchronous, it freezes the Python engine subprocess and blocks all other IPC requests until the download finishes.

---

## 3. Caveats

- We did not investigate whether the GGUF models can be downloaded successfully on poor networks, or how the hardware auto-detection behaves under systems without `psutil` (where it defaults to `4096MB` available RAM).
- We assumed that `save_notes` is a conceptual requirement from the user request that should map directly to `upsert_notes` in the database model.

---

## 4. Conclusion

The backend architecture is clean but contains several critical bugs and path discrepancies:
1. Script paths must be updated to target `frontend1/` instead of `frontend/`.
2. The progress mapping bug in `get_processing_progress` needs to map `"ready"` to `100`.
3. Vector deletion must be integrated into the `delete_document` flow to clean up FAISS indices.
4. The hardcoded `"not-installed"` status in `get_models` must check local directory `~/.khoji/models` for downloaded files.
5. `save_notes` should either be added to `Database` mapping to `upsert_notes` or the pipeline updated accordingly.

---

## 5. Verification Method

- **Path Verification**: Verify the path corrections by inspecting modified script files: `scripts/run-dev.sh` and `scripts/build-linux.sh`.
- **Database Inspection**: Verify database structure by reviewing `backend/python/khoji_engine/database/db.py`.
- **Subprocess Command Test**: Test JSON queries by executing `python3 backend/python/khoji_engine/main.py` directly, passing JSON lines via standard input:
  - Input: `{"action": "ping"}` -> Expected output: `{"status": "ok", "result": "pong"}`
  - Input: `{"action": "get_documents"}` -> Expected output: `{"status": "ok", "result": [...]}`

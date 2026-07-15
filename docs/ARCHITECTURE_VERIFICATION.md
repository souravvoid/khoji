# Architecture Verification - Khoji

**Subject:** Offline AI Knowledge Workspace (Tauri v2 + React 19 + Python + Rust)
**Scope:** Verification of the full data path from UI to engine and back, with file:line evidence.
**Method:** Static reading of the source tree. No code was modified.

## Summary

The end-to-end data path is real and wired correctly. The streaming path genuinely
emits `stream-token` (chat) and `progress-update` (document processing) events through
the Tauri event bus, parsed from NDJSON on the Rust side and re-emitted to the frontend.
The non-streaming request/response path is a line-based JSON protocol over the Python
child's stdin/stdout.

Three notable gaps were found (detailed at the end): a download-model false-success
path, no engine auto-restart on crash, and CSP disabled in the Tauri config.

| Stage        | Status   |
|--------------|----------|
| Frontend     | VERIFIED |
| IPC          | VERIFIED |
| Rust bridge  | VERIFIED |
| Python engine| VERIFIED |
| Handlers     | VERIFIED (1 gap) |
| OCR          | VERIFIED |
| Embeddings   | VERIFIED |
| Vector DB    | VERIFIED |
| LLM          | VERIFIED |
| Output       | VERIFIED |
| Resilience   | GAP (2)  |
| Security     | GAP (1)  |

---

## Stage-by-stage verification

### 1. Frontend (UI entry points)

- **Mechanism:** React 19 components invoke typed IPC wrappers. Document ingestion is
  driven from `App.tsx` which calls `processDocumentStream` and feeds progress updates
  into a processing-job store; document open calls `getDocument`.
- **Evidence:**
  - `frontend/src/App.tsx:97-102` - `processDocumentStream(filePath, (stage, pct) => ...)` wired to `updateProcessingJob`.
  - `frontend/src/App.tsx:106` - `getDocument(docId)` after processing completes.
  - `frontend/src/App.tsx:139-163` - `handleDocumentClick` loads full document detail.
  - `frontend/src/components/document/MindMapTab.tsx:42` - `generateMindmap` call.
  - `frontend/src/components/chat/ChatInput.tsx:21-32` - message send path (`onSend`).
- **Status:** VERIFIED

### 2. IPC (Tauri invoke + event listeners)

- **Mechanism:** `@tauri-apps/api/core` `invoke` for request/response commands;
  `@tauri-apps/api/event` `listen` for streaming events. The two streaming wrappers
  subscribe to `stream-token` and `progress-update` and forward each payload to a callback.
- **Evidence:**
  - `frontend/src/lib/ipc.ts:1-2` - imports `invoke` and `listen`.
  - `frontend/src/lib/ipc.ts:214-235` - `askAiStream` registers `listen('stream-token', ...)` (line 221) and invokes `ask_ai_stream` (line 226).
  - `frontend/src/lib/ipc.ts:237-251` - `processDocumentStream` registers `listen('progress-update', ...)` (line 241) and invokes `process_document_stream` (line 246).
  - `frontend/src/lib/ipc.ts:122-210` - typed invoke wrappers (`processDocument`, `searchDocuments`, `askAi`, `generateFlashcards`, `generateQuiz`, `generateTimeline`, `generateMindmap`, `saveNotes`, ...).
  - `frontend/src/lib/ipc.ts:104-120` - `parseResponse` unwraps `{ result: ... }` envelopes.
- **Status:** VERIFIED

### 3. Rust bridge (Tauri commands + NDJSON parsing)

- **Mechanism:** Tauri commands write a JSON action line to the Python child's stdin
  and read NDJSON lines back. For streaming commands, each non-terminal line is
  re-emitted as a Tauri event. `read_stream` parses NDJSON, handling `end`/`error`/
  passthrough line types. The Python child is held in a single `Mutex<Child>`.
- **Evidence:**
  - `frontend/src-tauri/src/lib.rs:27-29` - `PythonEngine { process: Mutex<Child> }`.
  - `frontend/src-tauri/src/lib.rs:33-54` - `read_stream` reads NDJSON, matches `type`, returns on `end`/`error`, calls `on_line` otherwise.
  - `frontend/src-tauri/src/lib.rs:189-217` - `ask_ai_stream` command writes `{action: chat_stream}` and emits `stream-token` per token (`app_clone.emit("stream-token", ...)` at line 212).
  - `frontend/src-tauri/src/lib.rs:221-245` - `process_document_stream` command emits `progress-update` (line 240) per progress line.
  - `frontend/src-tauri/src/lib.rs:87-157` - `start_python_engine` spawns the child and waits for the `{"type":"ready"}` line.
  - `frontend/src-tauri/src/lib.rs:479-481` - `PythonEngine` managed as Tauri state.
  - `frontend/src-tauri/src/lib.rs:482-504` - command registration list.
- **Status:** VERIFIED

### 4. Python engine (subprocess entry point)

- **Mechanism:** Reads one JSON action per line from stdin. If the action is in
  `STREAMING_ACTIONS`, it calls `handle_streaming` which emits one NDJSON line per
  event via `emit()`; otherwise it calls `handle_message` and writes a single JSON
  response line. The embedding model is pre-warmed in a background thread on startup.
- **Evidence:**
  - `backend/python/khoji_engine/main.py:19` - `STREAMING_ACTIONS = {"chat_stream", "process_document_stream"}`.
  - `backend/python/khoji_engine/main.py:40-62` - `handle_streaming` and `emit()` (lines 49-51) write `json.dumps(obj) + "\n"` and flush.
  - `backend/python/khoji_engine/main.py:64-102` - `main()` loop dispatches by action type.
  - `backend/python/khoji_engine/main.py:67-78` - embedding pre-warm background thread.
  - `backend/python/khoji_engine/main.py:80` - engine writes `{"type":"ready", ...}` to stdout.
- **Status:** VERIFIED

### 5. Handlers (dispatch + streaming handlers)

- **Mechanism:** `STREAM_HANDLERS` maps streaming actions to handlers that receive an
  `emit` callback; `ACTION_HANDLERS` maps synchronous actions. Streaming handlers emit
  `token`, `progress`, and `end`/`error` line types that Rust forwards.
- **Evidence:**
  - `backend/python/khoji_engine/handlers.py:394-397` - `STREAM_HANDLERS` table.
  - `backend/python/khoji_engine/handlers.py:401-422` - `ACTION_HANDLERS` table.
  - `backend/python/khoji_engine/handlers.py:327-367` - `handle_chat_stream` emits `{"type":"token","content":token}` (line 362) then `{"type":"end",...}` (line 363).
  - `backend/python/khoji_engine/handlers.py:370-391` - `handle_process_document_stream` emits `{"type":"progress", "stage", "pct"}` (line 380) then `end` (line 383).
- **Status:** VERIFIED (see Gap A for `handle_download_model`).

### 6. OCR pipeline

- **Mechanism:** `ocr_image` tries RapidOCR (ONNX) first, then falls back to the
  Tesseract CLI; if both fail it returns an empty result. PDF pages are rasterized with
  PyMuPDF before OCR.
- **Evidence:**
  - `backend/python/khoji_engine/pipeline/ocr.py:25-39` - `ocr_image` priority chain RapidOCR -> Tesseract -> none.
  - `backend/python/khoji_engine/pipeline/ocr.py:42-69` - `ocr_pdf_page` renders page to PNG via `fitz` then OCR.
  - `backend/python/khoji_engine/pipeline/ocr.py:83-108` - `_try_rapidocr` (RapidOCR).
  - `backend/python/khoji_engine/pipeline/ocr.py:111-129` - `_try_tesseract` (Tesseract CLI, `--psm 6`).
  - `backend/python/khoji_engine/pipeline/ocr.py:72-74` - `has_ocr_engine` capability check.
- **Status:** VERIFIED

### 7. Embeddings

- **Mechanism:** Sentence-Transformers `all-MiniLM-L6-v2` (384-dim). Model is loaded
  lazily and pre-warmed on engine start; embeddings are L2-normalized. Singleton accessor
  `get_embedder`.
- **Evidence:**
  - `backend/python/khoji_engine/ai/embeddings.py:13-14` - `MODEL_NAME = "all-MiniLM-L6-v2"`, `EMBEDDING_DIM = 384`.
  - `backend/python/khoji_engine/ai/embeddings.py:31-45` - `load()` constructs `SentenceTransformer`.
  - `backend/python/khoji_engine/ai/embeddings.py:47-58` - `embed()` with `normalize_embeddings=True`.
  - `backend/python/khoji_engine/ai/embeddings.py:81-85` - `get_embedder()` singleton.
- **Status:** VERIFIED

### 8. Vector DB (FAISS)

- **Mechanism:** FAISS `IndexFlatIP` (inner-product / cosine after normalization)
  persisted under `~/.khoji/vectors` (`vectors.index` + `metadata.json`). Thread-safe
  add/search/remove with periodic save.
- **Evidence:**
  - `backend/python/khoji_engine/ai/vector_search.py:17,25` - `EMBEDDING_DIM` import; store path `Path.home() / ".khoji" / "vectors"`.
  - `backend/python/khoji_engine/ai/vector_search.py:28,49,128,131` - `IndexFlatIP` used for create and rebuild.
  - `backend/python/khoji_engine/ai/vector_search.py:53-75` - `add_vectors` (normalize + save).
  - `backend/python/khoji_engine/ai/vector_search.py:77-105` - `search` returns ranked `{chunk_id, score, metadata}`.
  - `backend/python/khoji_engine/ai/vector_search.py:107-137` - `remove_document` (rebuilds index without the doc's vectors).
  - `backend/python/khoji_engine/ai/vector_search.py:165-169` - `get_vector_store()` singleton.
- **Status:** VERIFIED

### 9. LLM (local GGUF via llama-cpp)

- **Mechanism:** `llama-cpp-python` `Llama` loads a Q4 GGUF from `~/.khoji/models`
  (`GGUF_DIR`). Hardware auto-detection picks the largest model that fits RAM. Streaming
  generation yields token deltas. Singleton `get_llm` / `set_model`.
- **Evidence:**
  - `backend/python/khoji_engine/ai/llm.py:17` - `GGUF_DIR = Path.home() / ".khoji" / "models"`.
  - `backend/python/khoji_engine/ai/llm.py:26-55` - `MODEL_PRESETS` (Qwen2.5, SmolLM2, TinyLlama).
  - `backend/python/khoji_engine/ai/llm.py:85-104` - `detect_hardware` RAM-aware model selection.
  - `backend/python/khoji_engine/ai/llm.py:135-161` - `load()` constructs `Llama(...)` (`import from llama_cpp import Llama` at line 145).
  - `backend/python/khoji_engine/ai/llm.py:184-213` - `generate_stream` (`stream=True`, yields deltas).
  - `backend/python/khoji_engine/ai/llm.py:236-251` - `get_llm` / `set_model` singletons.
- **Status:** VERIFIED

### 10. Output (streaming back up + DB writes)

- **Mechanism:** Chat tokens flow `llm.generate_stream` -> `handle_chat_stream` emit
  `token` -> Rust `read_stream` -> `emit("stream-token")` -> frontend `askAiStream`
  `onToken` callback. Document processing progress flows `process_document_stream` emit
  `progress` -> Rust `emit("progress-update")` -> frontend `processDocumentStream`
  `onProgress`. Final `{type:"end", result}` payloads are returned by the commands.
  Persistent outputs (notes, flashcards, quiz, chunks/vectors) are written by the
  processing/DB layer, not streamed.
- **Evidence:**
  - `backend/python/khoji_engine/handlers.py:362` - `emit({"type":"token","content":token})`.
  - `frontend/src-tauri/src/lib.rs:212` - `app_clone.emit("stream-token", content)`.
  - `frontend/src/lib/ipc.ts:221-223` - listener forwards to `onToken`.
  - `backend/python/khoji_engine/handlers.py:380` - `emit({"type":"progress",...})`.
  - `frontend/src-tauri/src/lib.rs:240` - `emit("progress-update", {...})`.
  - `backend/python/khoji_engine/handlers.py:383-391` - final `end` result with `doc_id`, counts, `success`.
- **Status:** VERIFIED

---

## Gaps

### Gap A - `handle_download_model` reports success without verifying the download
`backend/python/khoji_engine/handlers.py:233-241` - `handle_download_model` calls
`llm.ensure_model()` and then unconditionally returns
`{"status":"ok","result":{"model_id":...,"downloaded":True}}`. If `ensure_model()` fails
(network error, disk full), it returns `False` but the handler ignores that return value
and still reports success. The frontend `downloadModel` (ipc.ts:184-186) therefore cannot
detect failures. **Type:** functional gap (false success), not a crash. **Severity:** Medium.

### Gap B - No engine auto-restart on crash
`frontend/src-tauri/src/lib.rs:27-29` - the engine is a single `Mutex<Child>`. If the
Python process exits (uncaught exception, OOM), `check_engine_alive` (lib.rs:159-168)
only surfaces an error on the *next* command; nothing respawns the child. The app must be
restarted. There is no supervisor/restart loop around `start_python_engine`. **Type:**
resilience gap. **Severity:** Medium.

### Gap C - CSP disabled
`frontend/src-tauri/tauri.conf.json:25-27` - `"security": { "csp": null }`. The Content
Security Policy is disabled, so the webview places no restrictions on script/resource
origins. For an offline app the blast radius is limited, but it removes a defense-in-depth
layer (e.g., against malicious document-derived content). **Type:** security gap.
**Severity:** Low-Medium.

---

## Streaming path verdict

**VERIFIED and real.** The token/progress streaming is not simulated:
- Rust `ask_ai_stream` emits `"stream-token"` (lib.rs:212).
- Rust `process_document_stream` emits `"progress-update"` (lib.rs:240).
- Python `handle_chat_stream` emits `{"type":"token"}` (handlers.py:362).
- Python `handle_process_document_stream` emits `{"type":"progress"}` (handlers.py:380).
- `read_stream` (lib.rs:33-54) is the NDJSON parser bridging Python stdout to Tauri events.

## Notes for follow-up

- The mind-map feature is currently broken at the frontend parse layer (see
  IMPROVEMENT_BACKLOG.md, High priority). The backend emits a valid `flowchart LR` with
  `-->` edges (`pipeline/structure_generator.py:105,111`), but `MindMapTab.tsx:10` strips
  lines containing `-->` and therefore never builds the parent/child hierarchy - it
  renders a flat list of top-level nodes. This is recorded as a borderline-bug High
  improvement rather than a crash.
- No code was changed during this verification.

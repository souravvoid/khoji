# Architecture Analysis

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Khoji Desktop Application                     │
├──────────────────┬──────────────────┬──────────────────────────┤
│   Frontend       │   Rust Shell     │   Python Engine          │
│   (React/TS)     │   (Tauri v2)     │   (khoji_engine)         │
├──────────────────┼──────────────────┼──────────────────────────┤
│ UI Components    │ App Lifecycle    │ Document Processing      │
│ Zustand Stores   │ Window Management│ AI Pipeline              │
│ IPC Client       │ File Dialogs     │ Vector Search            │
│ Keyboard Shortcuts│ Path Validation │ LLM Inference            │
│ Design System    │ Process Spawning │ SQLite Database          │
│                  │ JSON Bridge      │ Content Generation       │
└────────┬─────────┴────────┬─────────┴────────────┬────────────┘
         │                  │                      │
         │ Tauri invoke()   │ stdin/stdout JSON    │ Filesystem
         │                  │ (newline-delimited)  │ (~/.khoji/)
         ▼                  ▼                      ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  WebView (Blink) │  │ Python Child │  │ SQLite + FAISS + GGUF│
│  (Chromium)      │  │ Process      │  │ Models on disk       │
└──────────────────┘  └──────────────┘  └──────────────────────┘
```

## Layer Responsibilities

### Layer 1: Frontend (React/TypeScript)

**What it owns:**
- All user interface rendering
- Application state (5 Zustand stores)
- User input handling
- Keyboard shortcuts (6 global shortcuts)
- Theme management (light/dark/system)
- File selection via Tauri dialog API
- IPC call dispatch (18 invoke commands)

**What it does NOT own:**
- Any business logic
- Any data persistence
- Any file system access
- Any AI computation
- Any network requests

### Layer 2: Rust Shell (Tauri v2)

**What it owns:**
- Application lifecycle and window management
- Python process spawning and health monitoring
- File path validation and canonicalization
- File extension whitelist enforcement
- Mutex-serialized JSON bridge to Python
- Native file dialogs (via tauri_plugin_dialog)
- Environment variable cleanup for Python

**What it does NOT own:**
- Any business logic
- Any data persistence
- Any AI/ML computation
- Any document parsing

### Layer 3: Python Engine (khoji_engine)

**What it owns:**
- Document processing pipeline (all formats)
- Embedding model loading and inference
- FAISS vector index management
- Local LLM inference (llama-cpp-python)
- Chat/AI conversation logic
- Content generation (flashcards, quizzes, timelines, mind maps)
- Markdown generation and chunking
- Multi-format export
- SQLite database (7 tables)
- Model downloading and management
- Notes persistence
- Chat session persistence
- Action dispatch table (20 handlers)

## Communication Flow

### Request Flow (e.g., user searches)

```
1. User types query in SearchModal
2. React calls searchDocuments(query) in ipc.ts
3. ipc.ts calls invoke('search_documents', { query, limit })
4. Tauri routes to Rust command search_documents()
5. Rust serializes JSON: {"action":"search","payload":{"query":"...","limit":10}}
6. Rust writes JSON + "\n" to Python stdin
7. Python main.py reads line, dispatches to handle_search()
8. handle_search() embeds query, runs FAISS search, enriches results
9. Python writes JSON response + "\n" to stdout
10. Rust reads response line, returns as Result<String, String>
11. Tauri unwraps, passes to frontend
12. ipc.ts parseResponse() extracts result array
13. React renders SearchResultItem components
```

### Startup Flow

```
1. Tauri launches, main.rs calls khoji_lib::run()
2. start_python_engine() probes for python3/python
3. Resolves khoji_engine/main.py path (7 candidate locations + KHOJI_ENGINE env)
4. Spawns: python3 -v -m khoji_engine.main
5. Python starts, loads embedding model in background thread
6. Python emits: {"type":"ready","version":"1.0.0"}
7. Rust reads handshake, proceeds with Tauri builder
8. Tauri creates window, loads React app
9. React mounts, App.tsx calls loadDocuments()
10. IPC: get_documents → Python → SQLite → documents list
11. Library view renders with document cards
```

## Module Dependency Graph

```
Frontend (React)
  ├── stores/ (Zustand)
  │   ├── uiStore.ts       → (no deps)
  │   ├── documentStore.ts  → ipc.ts
  │   ├── chatStore.ts      → ipc.ts
  │   ├── settingsStore.ts  → ipc.ts
  │   └── reviewStore.ts    → (no deps)
  ├── lib/ipc.ts            → @tauri-apps/api/core
  ├── components/           → stores/, lib/ipc.ts, lib/keyboard.ts
  └── hooks/useKeyboard.ts  → stores/uiStore

Rust Shell (Tauri)
  ├── lib.rs
  │   ├── PythonEngine (Mutex<Child>)
  │   ├── 18 #[tauri::command] functions
  │   ├── start_python_engine()
  │   ├── send_message()
  │   └── validate_file_path()
  └── main.rs → lib.rs::run()

Python Engine (khoji_engine)
  ├── main.py              → handlers.py
  ├── handlers.py          → all pipeline/ai/database modules
  ├── pipeline/
  │   ├── processor.py     → extractors, markdown_generator, content_generator
  │   ├── pdf_extractor.py → PyMuPDF
  │   ├── docx_extractor.py→ python-docx
  │   ├── pptx_extractor.py→ python-pptx
  │   ├── epub_extractor.py→ ebooklib
  │   ├── ocr.py           → RapidOCR/Tesseract
  │   ├── markdown_generator.py
  │   ├── content_generator.py
  │   ├── structure_generator.py
  │   └── exporter.py      → db.py
  ├── ai/
  │   ├── embeddings.py    → sentence-transformers
  │   ├── llm.py           → llama-cpp-python
  │   └── vector_search.py → faiss-cpu
  └── database/db.py       → sqlite3
```

## Architectural Patterns

### 1. Bridge Pattern (Rust ↔ Python)
Rust acts as a thin bridge between the React frontend and the Python engine. The Rust layer performs no business logic — it validates paths, manages the Python process, and serializes/deserializes JSON messages.

**Strengths**: Clean separation of concerns. Python ecosystem access for AI/ML.
**Weakness**: Single-threaded bottleneck (Mutex). No streaming. No progress callbacks.

### 2. Singleton Pattern (Python AI Components)
Three module-level singletons: `get_embedder()`, `get_vector_store()`, `get_llm()`. Each lazily initializes on first use.

**Strengths**: Simple, consistent state, lazy initialization.
**Weakness**: Hard to test, no dependency injection, global mutable state.

### 3. Store Pattern (Frontend)
Five Zustand stores manage all state: UI chrome, documents, chat, settings, review. Each store is independent with no cross-store dependencies.

**Strengths**: Lightweight, no boilerplate, easy to use.
**Weakness**: No normalized state, no derived state, manual update patterns.

### 4. Pipeline Pattern (Document Processing)
`processor.py` orchestrates a sequential pipeline: extract → markdown → chunk → embed → study materials. Each step is a function call with error handling.

**Strengths**: Clear data flow, easy to reason about, progress tracking.
**Weakness**: No parallelism, no retry logic, synchronous blocking.

### 5. Action Dispatch Pattern (IPC)
`handlers.py` uses a dictionary mapping action strings to handler functions. All imports are deferred inside handlers for fast startup.

**Strengths**: Fast startup, extensible, clear routing.
**Weakness**: No type safety on action names, no request validation schema.

# Khoji — Architecture

Khoji ("explorer/seeker") is an **offline-first AI knowledge workspace**. A desktop
app (Tauri v2 + React 19 + TypeScript + Python 3.12 + Rust) that turns dropped
documents into notes, flashcards, quizzes, timelines, mind maps, and a RAG chat —
entirely on-device. No cloud, no telemetry, no network egress.

This document describes the system as built: the real 7 database tables
(`backend/python/khoji_engine/database/db.py`), the 21 Tauri commands
(`frontend/src-tauri/src/lib.rs`), and the NDJSON streaming IPC that the internal
docs understate. Streaming is implemented.

---

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Khoji Desktop Application                          │
├─────────────────────────┬────────────────────────┬────────────────────────┤
│  Frontend (React 19/TS) │   Rust Shell (Tauri v2) │  Python Engine         │
│                         │                        │  (khoji_engine)        │
│  App.tsx                │  lib.rs  (21 commands) │                        │
│  components/  (chat,    │  main.rs  (entry)      │  main.py   (IPC loop)  │
│    document, layout,    │  PythonEngine {        │  handlers.py           │
│    library, processing,  │    Mutex<Child> }     │  ai/                   │
│    review, search,      │  read_stream()        │    embeddings.py        │
│    settings, ui)        │  emit("stream-token") │    llm.py               │
│  stores/ (5 Zustand)   │  emit("progress-      │    vector_search.py     │
│    uiStore              │        update")       │  pipeline/              │
│    documentStore        │  validate_file_path() │    processor / extractors│
│    chatStore            │  start_python_engine()│    ocr / markdown /     │
│    settingsStore        │  tauri_plugin_dialog  │    content / structure /│
│    reviewStore          │                        │    exporter            │
│  lib/ipc.ts (invoke +   │                        │  database/db.py        │
│    streaming wrappers)  │                        │                        │
└───────────┬─────────────┴───────────┬────────────┴────────────┬───────────┘
            │  Tauri invoke()          │  JSON over stdin/stdout │  Filesystem
            │  listen("stream-token")  │  (newline-delimited)    │  ~/.khoji/
            │  listen("progress-update")│                       │
            ▼                          ▼                         ▼
     WebView (Blink)            Python Child Process      SQLite + FAISS + GGUF
                               (single subprocess)        on disk under ~/.khoji
```

---

## 2. Document Ingestion Pipeline

Entry: `process_document_stream` (streaming, emits `progress-update`) or
`process_document` (sync). Orchestrated by `pipeline/processor.py`.

```
PDF / DOCX / PPTX / EPUB / Image
        │
        ▼
┌───────────────────────┐
│ processor.py routes   │   by file extension
└───────────┬───────────┘
            │
   ┌────────┼─────────────────────────────────────────────┐
   ▼        ▼        ▼        ▼        ▼
┌────────┐┌───────┐┌───────┐┌───────┐┌──────────────────┐
│ pdf_   ││ docx_ ││ pptx_ ││ epub_ ││ ocr.py           │
│ extrac-││ extrac-││ extrac-││ extrac-││ (image input)    │
│ tor.py ││ tor.py││ tor.py││ tor.py││ RapidOCR →       │
│ PyMuPDF││python-││python-││ebooklib││ Tesseract fallback│
└───┬────┘│docx   ││pptx   │└───────┘└──────────────────┘
    │     └───┬───┘└───┬───┘
    └─────────┴────────┴───────────────────────────────┐
                                                        ▼
                                          ┌──────────────────────────┐
                                          │ markdown_generator.py    │
                                          │ heading-aware markdown   │
                                          └───────────┬──────────────┘
                                                      ▼
                                          ┌──────────────────────────┐
                                          │ chunking                 │
                                          │ 1000 chars / 200 overlap │
                                          └───────┬──────────┬───────┘
                                                  │          │
                          ┌───────────────────────┘          └──────────────────────┐
                          ▼                                                 ▼
                ┌──────────────────────┐                         ┌──────────────────────────┐
                │ ai/embeddings.py     │                         │ pipeline/content_generator│
                │ all-MiniLM-L6-v2     │                         │ + structure_generator.py  │
                │ 384-dim, L2-norm     │                         │ 20 flashcards, 10 quiz    │
                └──────────┬───────────┘                         │ timeline, mindmap (Mermaid)│
                           ▼                                     └───────────────┬──────────┘
                ┌──────────────────────┐                                         │
                │ ai/vector_search.py  │                                         │
                │ FAISS IndexFlatIP    │                                         │
                │ ~/.khoji/vectors     │                                         │
                └──────────┬───────────┘                                         │
                           └──────────────────────┬──────────────────────────────┘
                                                    ▼
                                       ┌──────────────────────────┐
                                       │ database/db.py (SQLite)  │
                                       │ documents, document_     │
                                       │ chunks, notes, flashcards│
                                       │ quiz_questions, chat_*   │
                                       └──────────────────────────┘
```

Key module paths:
- Text extraction: `pipeline/pdf_extractor.py` (PyMuPDF), `pipeline/docx_extractor.py`
  (python-docx), `pipeline/pptx_extractor.py` (python-pptx), `pipeline/epub_extractor.py`
  (ebooklib), `pipeline/ocr.py` (RapidOCR, Tesseract fallback).
- Markdown + chunking: `pipeline/markdown_generator.py`, `pipeline/processor.py`.
- Study material: `pipeline/content_generator.py` (flashcards, quiz — rule-based),
  `pipeline/structure_generator.py` (timeline regex, mind map from headings).
- Export: `pipeline/exporter.py` (Markdown, HTML, JSON, Anki, CSV, Mermaid, Flashcard, Quiz).

---

## 3. IPC Flow

Protocol: **JSON over stdin/stdout** between Rust and Python. Sync actions return a
single JSON line; streaming actions (`chat_stream`, `process_document_stream`) return
multiple NDJSON lines terminated by `{"type":"end", ...}` or `{"type":"error", ...}`.

### Sync request (example: search)
```
Frontend  lib/ipc.ts  invoke('search_documents', {query, limit})
   → Tauri command search_documents()         [frontend/src-tauri/src/lib.rs]
   → Rust serializes {"action":"search","payload":{...}}
   → send_message(): write JSON + "\n" to child stdin
   → Python main.py reads line → handle_message() → handlers.py dispatch
   → handler returns one JSON dict → Python writes it + "\n" to stdout
   → Rust read_line → returns Result<String,String> → Frontend parses
```

### Streaming request (chat tokens)
```
Frontend  lib/ipc.ts  invoke('ask_ai_stream', {doc_id, message, history})
   → Tauri command ask_ai_stream()            [frontend/src-tauri/src/lib.rs]
   → writes {"action":"chat_stream","payload":{...}} + "\n"
   → Python main.py routes to STREAM_HANDLERS["chat_stream"]
   → handler calls emit({type:"token", content:"..."}) per token
   → Rust read_stream() calls on_line for each line:
         app.emit("stream-token", content)
   → Frontend listen("stream-token") → ChatPanel accumulates tokens
   → Python emits {"type":"end","result":{...}} → Rust returns full result
```

### Streaming request (processing progress)
```
Frontend invoke('process_document_stream', {file_path})
   → Rust validates path via validate_file_path() (canonicalize + extension allowlist)
   → Python STREAM_HANDLERS["process_document_stream"] emits per stage:
         {"type":"progress","stage":"ocr|extract|markdown|chunk|embed|content","pct":0..100}
   → Rust read_stream() emits {"stage":..., "pct":...} via "progress-update" event
   → Frontend ProcessingModal renders live progress
   → Python emits {"type":"end","result":{...}}
```

`STREAMING_ACTIONS = {"chat_stream", "process_document_stream"}` is defined in
`backend/python/khoji_engine/main.py`; the worker dispatcher `handle_streaming()`
writes each NDJSON line with `sys.stdout.write(json.dumps(obj)+"\n"); flush()`.

Rust side: `read_stream()` (lib.rs:33) reads lines from the child stdout, ignores
empty lines, and on `{"type":"end"}` returns the `result` field; on
`{"type":"error"}` returns the error string; otherwise calls the `on_line` closure so
the command can emit a Tauri event. All Python access is guarded by
`Mutex<Child>` (`PythonEngine`), so only one Rust command talks to Python at a time.

---

## 4. Database Schema (real 7 tables)

SQLite at `~/.khoji/khoji.db`, WAL mode, `check_same_thread=False`,
`foreign_keys=ON`, `busy_timeout=5000`. DDL lives in `database/db.py` (`_SCHEMA_SQL`).
Cascade deletes remove chunks/notes/flashcards/quiz/chat sessions when a document is
deleted.

**documents** — top-level document metadata
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| filename | TEXT NOT NULL | |
| title | TEXT NOT NULL | |
| file_path | TEXT NOT NULL UNIQUE | canonical path |
| file_size | INTEGER NOT NULL DEFAULT 0 | bytes |
| mime_type | TEXT NOT NULL DEFAULT 'application/pdf' | |
| page_count | INTEGER | nullable |
| status | TEXT NOT NULL DEFAULT 'uploaded' | processing/uploaded/... |
| created_at | TEXT NOT NULL | UTC ISO |
| updated_at | TEXT NOT NULL | UTC ISO |

**document_chunks** — embedded text chunks
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| document_id | TEXT NOT NULL FK→documents.id ON DELETE CASCADE | |
| chunk_index | INTEGER NOT NULL | order |
| content | TEXT NOT NULL | chunk text |
| page_number | INTEGER | nullable |
| section_title | TEXT | nullable |
| char_offset | INTEGER | nullable |
| char_length | INTEGER | nullable |
| embedding_id | INTEGER | nullable index into FAISS |
| created_at | TEXT NOT NULL | |
| (index idx_chunks_doc on document_id) | | |

**notes** — editable extracted notes (one per document)
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| document_id | TEXT NOT NULL UNIQUE FK→documents.id ON DELETE CASCADE | |
| content | TEXT NOT NULL DEFAULT '' | markdown notes |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | |

**flashcards** — spaced-repetition cards (SM-2)
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| document_id | TEXT NOT NULL FK→documents.id ON DELETE CASCADE | |
| front | TEXT NOT NULL | question |
| back | TEXT NOT NULL | answer |
| card_type | TEXT NOT NULL DEFAULT 'basic' | |
| ease_factor | REAL NOT NULL DEFAULT 2.5 | SM-2 |
| interval_days | INTEGER NOT NULL DEFAULT 1 | SM-2 |
| next_review_at | TEXT NOT NULL | UTC ISO |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | |
| (index idx_fc_doc on document_id) | | |

**quiz_questions** — multiple-choice questions
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| document_id | TEXT NOT NULL FK→documents.id ON DELETE CASCADE | |
| question | TEXT NOT NULL | |
| options_json | TEXT NOT NULL | JSON array of strings |
| correct_answer_index | INTEGER NOT NULL | |
| explanation | TEXT NOT NULL DEFAULT '' | |
| difficulty | TEXT NOT NULL DEFAULT 'medium' | |
| created_at | TEXT NOT NULL | |
| (index idx_quiz_doc on document_id) | | |

**chat_sessions** — persisted chat conversations
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| document_id | TEXT REFERENCES documents.id ON DELETE SET NULL | nullable |
| title | TEXT NOT NULL DEFAULT 'New Chat' | |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | |

**chat_messages** — individual messages in a session
| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| session_id | TEXT NOT NULL FK→chat_sessions.id ON DELETE CASCADE | |
| role | TEXT NOT NULL | user/assistant/system |
| content | TEXT NOT NULL | message body |
| sources_json | TEXT | JSON of retrieved chunks (nullable) |
| created_at | TEXT NOT NULL | |
| (index idx_msg_session on session_id) | | |

Note: the internal `PROJECT_CONTEXT.md` lists a `workspaces` table and a `chunks`
table; those are stale. The real schema has **document_chunks** (not `chunks`) and
**no** `workspaces` table. Chat is fully multi-turn: `ask_ai_stream` accepts a
`history` payload that is forwarded to `LocalLLM.generate_stream`, and
`save_chat_session`/`add_chat_message` persist turns via `chat_sessions` +
`chat_messages`.

---

## 5. Model Flow (On-Device AI)

```
        ┌─────────────────────── Local Embeddings ───────────────────────┐
        │ ai/embeddings.py                                              │
        │   SentenceTransformer("all-MiniLM-L6-v2")                     │
        │   384-dim, normalize_embeddings=True                          │
        │   pre-warmed in daemon thread at engine startup (main.py)     │
        └───────────────────────────────┬──────────────────────────────┘
                                         │ embed query AND chunks
                                         ▼
        ┌─────────────────────── Vector Search ─────────────────────────┐
        │ ai/vector_search.py                                          │
        │   FAISS IndexFlatIP(384), inner-product = cosine (L2-norm)   │
        │   persist: ~/.khoji/vectors/vectors.index + metadata.json    │
        │   threading.Lock() around add/remove/save                    │
        │   top-k retrieval (default k=10) enriches chat + search      │
        └───────────────────────────────┬──────────────────────────────┘
                                         │ top chunks as context
                                         ▼
        ┌─────────────────────── Local LLM ────────────────────────────┐
        │ ai/llm.py  (llama-cpp-python, CPU-only n_gpu_layers=0)        │
        │   Qwen2.5-0.5B  (default, ~500MB)                             │
        │   Qwen2.5-1.5B  (~1.2GB)                                      │
        │   SmolLM2-1.7B  (~1.4GB)                                      │
        │   TinyLlama-1.1B (~900MB)                                     │
        │   generate_stream() yields tokens → NDJSON → "stream-token"  │
        │   detect_hardware() picks model fitting available RAM        │
        │   GGUF at ~/.khoji/models/ (downloaded on demand)            │
        └───────────────────────────────────────────────────────────────┘
```

- Embeddings: `all-MiniLM-L6-v2`, 384-dim, L2-normalized so FAISS
  `IndexFlatIP` inner product equals cosine similarity.
- LLM: GGUF Q4_K_M quantized, loaded lazily on first `generate()`. `n_threads`
  leaves 2 cores for the OS; `n_ctx` 2048–4096. `generate_stream` streams tokens.

---

## 6. Folder Structure

```
hackathon/
├── backend/python/khoji_engine/
│   ├── main.py                 # IPC loop + streaming dispatch (NDJSON)
│   ├── handlers.py             # ACTION_HANDLERS + STREAM_HANDLERS dispatch
│   ├── ai/
│   │   ├── embeddings.py       # all-MiniLM-L6-v2, 384-dim
│   │   ├── llm.py              # llama-cpp-python, 4 GGUF presets
│   │   └── vector_search.py    # FAISS IndexFlatIP + disk persistence
│   ├── database/db.py          # SQLite, 7-table schema
│   └── pipeline/
│       ├── processor.py        # ingestion orchestrator
│       ├── pdf_extractor.py    # PyMuPDF
│       ├── docx_extractor.py   # python-docx
│       ├── pptx_extractor.py   # python-pptx
│       ├── epub_extractor.py   # ebooklib
│       ├── ocr.py              # RapidOCR → Tesseract
│       ├── markdown_generator.py
│       ├── content_generator.py# flashcards + quiz (rule-based)
│       ├── structure_generator.py # timeline + mindmap
│       └── exporter.py         # 8 export formats
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # root routing, theme, upload
│   │   ├── components/         # chat, document, layout, library, processing,
│   │   │                       #   review, search, settings, ui
│   │   ├── stores/             # uiStore, documentStore, chatStore,
│   │   │                       #   settingsStore, reviewStore (Zustand)
│   │   └── lib/ipc.ts          # Tauri invoke + streaming wrappers
│   └── src-tauri/
│       ├── src/lib.rs          # 21 Tauri commands + streaming bridge
│       └── src/main.rs         # entry → khoji_lib::run()
├── scripts/                    # build-linux.sh, run-dev.sh, download-models.py
└── docs/                       # context, diagrams, analysis
```

---

## 7. Thread Model

- **One Python engine subprocess.** Rust spawns `python3 -m khoji_engine.main` once
  at startup (`start_python_engine`, lib.rs:87). It probes `python3`/`python`, resolves
  `main.py` across 7 candidate paths + `KHOJI_ENGINE` env, clears conflicting env vars
  (`LD_LIBRARY_PATH`, `PYTHONHOME`, `PYTHONPATH`, `APPIMAGE`, `APPDIR`), and reads the
  startup handshake `{"type":"ready","version":"1.0.0"}`.
- **Rust Mutex<Child>.** The `PythonEngine` state wraps the child process in a `Mutex`,
  serializing all Tauri→Python calls. A long-running `process_document` therefore blocks
  other commands, which is why progress is pushed as events rather than polled.
- **Pre-warm embedder thread.** `main.py` launches a daemon `threading.Thread` that
  calls `get_embedder().load()` before the IPC loop, hiding the ~2–3 s model load.
- **Vector store lock.** `ai/vector_search.py` guards index mutation and persistence
  with its own `threading.Lock()`.
- **Background stderr drain.** Rust spawns a thread forwarding Python stderr (`[python]`)
  so the pipe never blocks.

---

## 8. Memory Model

All state persists on disk under the user home directory; nothing is kept only in RAM.

| What | Path | Format |
|------|------|--------|
| SQLite database | `~/.khoji/khoji.db` | WAL (`-wal`/`-shm`), 7 tables |
| FAISS index | `~/.khoji/vectors/vectors.index` + `metadata.json` | IndexFlatIP + chunk_ids/metadata |
| LLM GGUF models | `~/.khoji/models/*.gguf` | Q4_K_M quantized |
| Embedding model | `~/.cache/huggingface/.../all-MiniLM-L6-v2` | sentence-transformers |

- Vectors are L2-normalized; `remove_document` reconstructs remaining vectors and
  rebuilds the index (O(n) in vector count, acceptable for desktop scale).
- Chat history, notes, flashcards (with SM-2 scheduling), and quiz items are durable in
  SQLite and survive restarts.
- Typical peak footprint on an 8 GB machine: ~200 MB base + ~80 MB embeddings + up to
  ~1.4 GB LLM ≈ < 2 GB, comfortably within budget.

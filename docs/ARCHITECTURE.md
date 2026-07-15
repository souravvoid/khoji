# Khoji — Architecture

Offline AI Knowledge Workspace. Desktop application (Linux AppImage) that ingests
documents, builds a local vector index, and lets the user search, chat, and
generate study material — entirely on-device, no cloud.

## Stack

| Layer | Technology |
|-------|------------|
| Shell / runtime bridge | Rust (Tauri v2) — `frontend/src-tauri/src/lib.rs` |
| UI | React 19 + TypeScript, Vite, Tailwind v4, Zustand |
| AI engine (subprocess) | Python 3.14, run as `python3 -m khoji_engine.main` |
| Embeddings | `sentence-transformers` `all-MiniLM-L6-v2` (384-dim, CPU) |
| Vector search | FAISS `IndexFlatIP` (cosine), persisted at `~/.khoji/vectors` |
| LLM | `llama-cpp-python` GGUF: `qwen2.5-0.5b/1.5b`, `smollm2-1.7b`, `tinyllama-1.1b` |
| OCR | RapidOCR (ONNX) → Tesseract CLI → skip |
| Database | SQLite (`~/.khoji/khoji.db`) |
| Build / packaging | `scripts/build-linux.sh` → `tauri build --bundles appimage` → `Khoji_1.0.0_amd64.AppImage` |

## Process model

```
┌──────────┐    JSON over stdin/stdout    ┌──────────────────────┐
│  React  │ ───IPC (Tauri bridge)───▶│  Rust lib.rs (spawns &  │
│  UI    │◀─────────────────────────│  supervises Python engine)│
└──────────┘                            └──────────────────────┘
                                                    │  python3 -m khoji_engine.main
                                                    ▼
                                         ┌────────────────────────────┐
                                         │  khoji_engine (subprocess)  │
                                         │  main.py → handlers.py         │
                                         │  pipeline/*  ai/*  database/* │
                                         └────────────────────────────┘
```

- The Rust bridge (`lib.rs`) launches the engine, spawns a **background stdout
  reader thread**, and **auto-respawns** the engine if it exits (so a crashed
  Python process never bricks the UI). Synchronous actions get one NDJSON
  response line; streaming actions (`chat_stream`, `process_document_stream`)
  emit `progress`/`token`/`end` lines and time out after 30 s.
- The Python engine reads one JSON `{"action","payload"}` per stdin line and
  writes one JSON response (or a stream of them) to stdout; logs go to stderr.

## Key modules (backend/python/khoji_engine)

| Module | Responsibility |
|--------|----------------|
| `main.py` | stdin/stdout loop, action dispatch, embedder pre-warm thread |
| `handlers.py` | `ACTION_HANDLERS` + `STREAM_HANDLERS` dispatch table |
| `ai/embeddings.py` | MiniLM wrapper, singleton `get_embedder()` |
| `ai/vector_search.py` | FAISS store, singleton `get_vector_store()` |
| `ai/llm.py` | `LocalLLM` (llama-cpp), `detect_hardware()`, `get_llm()` |
| `pipeline/processor.py` | ingest orchestrator: extract → notes → chunks → embed → study material |
| `pipeline/*_extractor.py` | PDF / DOCX / PPTX / EPUB / image-OCR extractors |
| `pipeline/markdown_generator.py` | notes markdown + chunking |
| `pipeline/content_generator.py` | rule-based flashcards & quiz |
| `pipeline/structure_generator.py` | timeline (date parsing) + mind-map/mermaid |
| `pipeline/exporter.py` | markdown / html / json / anki / csv / quiz / mermaid exports |
| `database/db.py` | SQLite schema + CRUD (`Database`) |

## Data flow — ingest (`process_document_stream`)

1. Extract text by extension (`pdf`/`docx`/`pptx`/`epub`/`txt`/`md`/`csv`/`html`/`rtf`/images→OCR).
2. Generate notes markdown via `generate_markdown`, persist via `upsert_notes`.
3. Chunk notes, persist via `add_chunks`.
4. Embed each chunk (MiniLM) and index into FAISS (`add_vectors`).
5. Rule-based flashcards + quiz, persisted (old rows replaced, not stacked).
6. Mark document `status="ready"`.

## Data flow — chat / study features

`chat`, `chat_stream`, `generate_flashcards`, `generate_quiz`,
`generate_timeline`, `generate_mindmap` all read the persisted **notes**
(`get_notes(doc_id)`); chat/timeline/mindmap also pass notes as the LLM
context. Semantic `search` embeds the query and queries FAISS.

## Database schema (`~/.khoji/khoji.db`)

`documents` · `document_chunks` · `notes` (1:1 per doc) · `flashcards` ·
`quiz_questions` · `chat_sessions` · `chat_messages`. FAISS vectors live in a
separate file (`vectors.index` + `metadata.json`) under `~/.khoji/vectors`.

## Configuration / entry points

- Engine entry: `backend/python/khoji_engine/main.py`
- Tauri config: `frontend/src-tauri/tauri.conf.json` (CSP hardened)
- Data home: `~/.khoji/` (DB, vectors, GGUF models)
- Launch: `KHOJI_ENGINE=$(pwd)/backend/python/khoji_engine/main.py ./Khoji_1.0.0_amd64.AppImage`

# Khoji — Project Context

> Last updated: 2026-07-14
> Version: 1.0.0 (streaming IPC landed)

## Product Vision

Khoji ("explorer/seeker") is an offline-first AI knowledge workspace. Drop a document → get Markdown notes, flashcards, quiz, mind map, timeline, and AI chat — entirely on-device. No cloud, no telemetry, no data leaves the machine.

## Architecture

```
┌─ Tauri 2 Shell (Rust) ────────────────────────────────┐
│  React Frontend (Vite + TSX) ◄── IPC ──► Python Engine │
│  Zustand stores          JSON over stdin/stdout        │
│  TailwindCSS v4          PyMuDF / RapidOCR / FAISS     │
│  lucide-react            llama-cpp-python / SQLite     │
│  framer-motion           sentence-transformers         │
└────────────────────────────────────────────────────────┘
```

**IPC Protocol:** JSON over stdin/stdout (synchronous + streaming NDJSON)
**Streaming IPC:** Chat tokens (stream-token events) + document processing progress (progress-update events) via Tauri `Emitter`
**DB:** SQLite at `~/.khoji/khoji.db` (WAL mode, 7 tables)
**Vectors:** FAISS IndexFlatIP at `~/.khoji/vectors/`
**Models:** GGUF files at `~/.khoji/models/`

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Tauri v2 (Rust) | Window mgmt, file dialogs, process spawning |
| Frontend | React 19 + TypeScript + Vite | UI, state, components |
| Styling | Tailwind CSS v4 + CSS tokens | BMW M "industrial precision" |
| State | Zustand (5 stores) | uiStore, documentStore, chatStore, settingsStore, reviewStore |
| Backend | Python 3.14 | AI engine, doc processing, DB |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | 384-dim vectors |
| Vector search | FAISS IndexFlatIP | Cosine similarity |
| LLM | llama-cpp-python (Qwen2.5 GGUF) | Local inference |
| Database | SQLite (WAL mode) | All persistence |
| PDF | PyMuPDF | Text extraction |
| OCR | RapidOCR / Tesseract | Image fallback |
| Testing | Playwright (E2E), pytest (backend) | |

## Project Structure

```
hackathon/
├── backend/python/khoji_engine/
│   ├── main.py                # IPC loop + streaming dispatch
│   ├── handlers.py            # 20+ action handlers + streaming handlers
│   ├── ai/                    # embeddings, llm, vector_search
│   ├── database/db.py         # SQLite CRUD (7 tables)
│   └── pipeline/              # processor, extractors, ocr, markdown, content, structure, export
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Root routing + theme + file upload
│   │   ├── components/        # 31 React components (chat, document, layout, library, etc.)
│   │   ├── stores/            # 5 Zustand stores
│   │   └── lib/ipc.ts         # Tauri invoke wrappers + streaming wrappers
│   └── src-tauri/src/lib.rs   # 20+ Tauri commands + streaming bridge
├── scripts/                   # build-linux, run-dev, download-models
└── docs/                      # Project documentation
```

## AI Pipeline (Ingestion)

1. Document registration (UUID, status=processing)
2. Text extraction (PyMuPDF/docx/pptx/epub/OCR by extension)
3. OCR (RapidOCR → Tesseract fallback for images)
4. Markdown generation (rule-based heading detection)
5. Text chunking (1000-char windows, 200-char overlap)
6. Embedding (all-MiniLM-L6-v2, 384-dim)
7. FAISS IndexFlatIP persist
8. DB writes (chunks, notes, flashcards, quiz_questions)
9. Content generation (rule-based: 20 flashcards + 10 quiz)
10. Streaming progress events throughout (OCR→Extract→Markdown→Chunk→Embed→Content)

## AI Pipeline (Chat)

1. Embed user query → FAISS top-5 chunks → build prompt → LLM inference → stream tokens
2. Per-token streaming via NDJSON through Rust bridge

## Models

| Model | Size | RAM | Speed (i5 CPU) |
|-------|------|-----|----------------|
| all-MiniLM-L6-v2 | 80MB | ~500MB | <1s/batch |
| Qwen 2.5 0.5B Q8 | 469MB | ~700MB | 8-12 tok/s |
| Qwen 2.5 1.5B Q4 | 591MB | ~900MB | 4-6 tok/s |

**Peak RAM:** ~200MB idle + 500MB embeddings + 900MB LLM ≈ 1.6GB (well within 8GB)

## IPC Commands

**Synchronous (18):** ping, process_document, search, chat, generate_flashcards, generate_quiz, get_documents, get_document, delete_document, export_document, get_chat_history, get_models, download_model, check_processing_status, get_processing_progress, generate_timeline, generate_mindmap, save_notes, save_chat_session

**Streaming (2):** chat_stream (per-token), process_document_stream (per-stage progress)

## Database Schema (7 tables)

- **documents** — id, filename, title, file_path, file_size, page_count, status, timestamps
- **chunks** — id, document_id, content, chunk_index, page_number, char_offset, char_length
- **notes** — id, document_id (UNIQUE), content, word_count, timestamps
- **flashcards** — id, document_id, front, back, card_type, difficulty, tags
- **quiz_questions** — id, document_id, question, options (JSON), correct_answer_index, explanation
- **chat_sessions** — id, document_id, title, messages (JSON blob), timestamps
- **workspaces** — id, name, description, created_at (exists in schema, not in UI)

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| PDF import | ✅ | PyMuPDF |
| Image import | ✅ | OCR pipeline |
| DOCX/PPTX/EPUB | ✅ | python-docx, python-pptx, ebooklib |
| OCR | ✅ | RapidOCR → Tesseract |
| Markdown notes | ✅ | Rule-based, editable, save to DB |
| Flashcards | ✅ | 20 rule-based cards, SM-2 review |
| Quiz | ✅ | 10 MCQ, rule-based |
| AI chat | ✅ | RAG with doc context, streaming tokens |
| Semantic search | ✅ | FAISS, enriched results |
| Timeline | ✅ | Regex-based extraction |
| Mind map | ✅ | Mermaid diagram from headings |
| Export | ✅ | Markdown, HTML, JSON, Anki, CSV, Mermaid, Flashcard, Quiz |
| Light/Dark/System | ✅ | Persisted |
| Model management | ✅ | Download, hardware detection, select in Settings |
| Streaming IPC | ✅ | Chat tokens + processing progress |
| Theme/design | ✅ | BMW M-inspired |
| Keyboard shortcuts | ✅ | 6 global shortcuts |
| E2E tests | ✅ | 14 Playwright tests |

## Known Limitations

- No conversation history in chat (single-turn only)
- No workspace isolation (schema exists, no UI)
- No encryption at rest
- FAISS full rebuild on document deletion
- No multi-provider LLM support (local only)
- Single-threaded Python bottleneck (Mutex)
- No memory management for LLM (loaded until process exits)

## Current Health

- **Architecture** ★★★★☆ — Clean 3-layer separation, but Mutex bottleneck and no dependency injection
- **Frontend** ★★★★☆ — Well-structured components, but no normalized state, no derived state
- **Backend** ★★★★☆ — Comprehensive pipeline, deferred imports fast startup, but singleton anti-pattern
- **Database** ★★★★★ — SQLite WAL, clean schema, adequate for desktop
- **AI** ★★★☆☆ — Works but limited: rule-based content, no multi-turn chat, no GPU
- **OCR** ★★★★☆ — Dual RapidOCR/Tesseract, works reliably, moderate speed
- **Performance** ★★★★☆ — Under 2GB peak RAM, responsive with streaming, cold LLM load slow
- **Testing** ★★★☆☆ — 14 E2E tests + 2 backend tests, low coverage
- **Security** ★☆☆☆☆ — CSP disabled, no input sanitization, no encryption
- **Documentation** ★★★★★ — Extensive internal docs, context files, decision records

## Target Hardware

Intel Core i5 12th Gen U, 8 GB RAM, Integrated Intel Graphics, Fedora Linux

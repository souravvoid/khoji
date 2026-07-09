# KHOJI MVP Reference

> Generated: 2026-07-07
> Source: All Markdown documents, code review, and architecture analysis

---

## Project Overview

**Khoji** ("explorer/seeker") — Offline AI Knowledge Workspace.
OSDHack 2026 submission. Tauri 2 + React 19 + Python backend.

**Core promise:** Drop a PDF → get Markdown notes, flashcards, quiz, mind map, timeline, and AI chat — entirely offline.

**Target hardware:** Intel Core i5-1235U, 8GB RAM, integrated GPU, Fedora Linux.

---

## Architecture

```
┌─ Tauri 2 Shell (Rust) ────────────────────────────────┐
│  React Frontend (Vite + TSX) ◄── IPC ──► Python Engine │
│  Zustand stores          JSON over stdin/stdout        │
│  TailwindCSS v4          PyMuPDF / RapidOCR / FAISS    │
│  lucide-react            llama-cpp-python / SQLite     │
│  framer-motion           sentence-transformers         │
└────────────────────────────────────────────────────────┘
```

**IPC Protocol:** JSON over stdin/stdout (synchronous request-response)
**DB:** SQLite at `~/.khoji/khoji.db` (WAL mode)
**Vectors:** FAISS IndexFlatIP at `~/.khoji/vectors/`
**Models:** GGUF files at `~/.khoji/models/`

---

## Project Structure

```
hackathon/
├── backend/python/              # Python AI engine
│   ├── khoji_engine/
│   │   ├── main.py              # IPC loop (stdin/stdout)
│   │   ├── ai/
│   │   │   ├── embeddings.py    # all-MiniLM-L6-v2 (384-dim)
│   │   │   ├── llm.py           # llama-cpp-python (Qwen 0.5B/1.5B)
│   │   │   └── vector_search.py # FAISS IndexFlatIP
│   │   ├── database/
│   │   │   └── db.py            # SQLite CRUD (6 tables)
│   │   ├── export/              # (empty, exports in pipeline/)
│   │   └── pipeline/
│   │       ├── processor.py     # Master orchestrator
│   │       ├── pdf_extractor.py # PyMuPDF
│   │       ├── ocr.py           # RapidOCR → Tesseract
│   │       ├── docx_extractor.py
│   │       ├── pptx_extractor.py
│   │       ├── epub_extractor.py
│   │       ├── markdown_generator.py
│   │       ├── content_generator.py  # Flashcards + Quiz
│   │       ├── structure_generator.py # Timeline + MindMap
│   │       └── exporter.py      # 6 format export
│   └── pyproject.toml
├── frontend/                    # Tauri + React app
│   ├── src/
│   │   ├── App.tsx              # Root routing
│   │   ├── components/
│   │   │   ├── chat/            # ChatInput, ChatMessage, ChatPanel
│   │   │   ├── document/        # Workspace, Tabs, Export
│   │   │   ├── layout/          # AppShell, Sidebar, TopBar, StatusBar
│   │   │   ├── library/         # LibraryView, DocumentCard, UploadZone
│   │   │   ├── processing/      # ProcessingModal, PipelineVisualization
│   │   │   ├── review/          # FlashcardReview, RatingButtons, ReviewStats
│   │   │   ├── search/          # SearchModal, SearchResultItem
│   │   │   ├── settings/        # SettingsDrawer, ModelCard, ModelManager
│   │   │   └── ui/              # 13 reusable components
│   │   ├── stores/              # Zustand (5 stores)
│   │   └── lib/ipc.ts           # Tauri invoke wrappers
│   └── src-tauri/               # Rust code
│       ├── src/lib.rs           # 16 Tauri commands + Python engine
│       └── src/main.rs
├── scripts/                     # build-linux, run-dev, download-models
├── ui/                          # Design mockups (13 PNGs)
├── project-review/              # Analysis documents (10 files)
└── docs/                        # This document
```

---

## IPC Commands (16 total)

| Command | Python Handler | Status |
|---------|---------------|--------|
| `ping` | inline | ✅ Working |
| `process_document` | `processor.process_document_sync()` | ✅ Working |
| `search` | `vector_search.search()` | ✅ Working |
| `chat` | `llm.chat()` | ✅ Working |
| `generate_flashcards` | `content_generator.generate_flashcards()` | ✅ Working |
| `generate_quiz` | `content_generator.generate_quiz()` | ✅ Working |
| `get_documents` | `db.list_documents()` | ✅ Working |
| `get_document` | `db.get_document()` | ✅ Working |
| `delete_document` | `db.delete_document()` | ✅ Working |
| `export_document` | `exporter.export_document()` | ✅ Working |
| `get_chat_history` | `db.list_chat_sessions()` | ✅ Working |
| `get_models` | `llm.MODEL_PRESETS` | ✅ Working |
| `download_model` | `llm.ensure_model()` | ✅ Working |
| `check_processing_status` | `db.get_document().status` | ✅ Working |
| `get_processing_progress` | `db.get_document().status` | ✅ Working |
| `generate_timeline` | `structure_generator.generate_timeline()` | ✅ Working |
| `generate_mindmap` | `structure_generator.generate_mermaid_diagram()` | ✅ Working |
| `save_notes` | `db.save_notes()` | ✅ Working |
| `save_chat_session` | `db.save_chat_session()` | ✅ Working |

---

## Database Schema (SQLite, 6 tables)

- **documents** — id, filename, title, file_path, file_size, page_count, status, timestamps
- **chunks** — id, document_id, content, chunk_index, page_number, char_offset, char_length
- **notes** — id, document_id (UNIQUE), content, word_count, timestamps
- **flashcards** — id, document_id, front, back, card_type, difficulty, tags
- **quiz_questions** — id, document_id, question, options (JSON), correct_answer_index, explanation
- **chat_sessions** — id, document_id, title, messages (JSON blob), timestamps

---

## AI Pipeline (Ingestion)

1. **Document Registration** — UUID, status=processing
2. **Text Extraction** — Route by extension (PyMuPDF/docx/pptx/epub/OCR)
3. **OCR** — RapidOCR → Tesseract (when images or no text)
4. **Markdown Generation** — Rule-based heading detection
5. **Text Chunking** — 1000-char windows, 200-char overlap
6. **Embedding Generation** — all-MiniLM-L6-v2 (384-dim)
7. **Vector Store** — FAISS IndexFlatIP persist
8. **Database Writes** — chunks, notes, flashcards, quiz_questions
9. **Content Generation** — Rule-based flashcards (20) + quiz (10)

---

## AI Pipeline (Query / Chat)

1. Embed user query (same model)
2. FAISS search top-5 chunks
3. Build prompt with document context
4. LLM inference (Qwen 0.5B/1.5B GGUF via llama-cpp-python)
5. Return response string

---

## Models

| Model | Size | RAM | Speed (i5 CPU) |
|-------|------|-----|----------------|
| all-MiniLM-L6-v2 | 80MB | ~500MB | <1s/batch |
| Qwen 2.5 0.5B Q8 | 469MB | ~700MB | 8-12 tok/s |
| Qwen 2.5 1.5B Q4 | 591MB | ~900MB | 4-6 tok/s |

**Peak RAM:** ~1.8GB OS + 500MB embeddings + 900MB LLM ≈ 3.2GB ✓ (within 8GB)

---

## Feature Status

### MVP Features (Required for demo)

| Feature | Status | Notes |
|---------|--------|-------|
| PDF import | ✅ Working | PyMuPDF |
| Image import | ✅ Working | OCR pipeline |
| OCR | ✅ Working | RapidOCR → Tesseract |
| Text extraction | ✅ Working | All 5 formats |
| Markdown notes | ✅ Working | Rule-based |
| Summary | ✅ Working | Built into markdown |
| Flashcards | ✅ Working | 20 cards, rule-based |
| Quiz | ✅ Working | 10 MCQ, rule-based |
| Basic AI chat | ✅ Working | RAG with doc context |
| Semantic search | 🟡 Backend ✅, Frontend ❌ | SearchModal uses title filter |
| Export Markdown | ✅ Working | + HTML, JSON, Anki, Mermaid |
| Light/Dark theme | ✅ Working | Persisted to localStorage |
| Responsive layout | ✅ Working | 1-4 column grid |

### Critical Fixes Needed (IMP-01 to IMP-06)

| ID | Fix | Effort | Priority |
|----|-----|--------|----------|
| IMP-01 | Wire semantic search in SearchModal | 2h | 🔴 Critical |
| IMP-02 | Fix flashcard 3D flip animation | 30m | 🔴 Critical |
| IMP-03 | Save notes edits to DB | 1h | 🔴 Critical |
| IMP-04 | Fix script paths (frontend1/ → frontend/) | 5m | 🔴 Critical |
| IMP-05 | Add loading state during LLM inference | 30m | 🟠 High |
| IMP-06 | Fix document deletion (cascade to DB+FAISS) | 1h | 🟠 High |

### Important Improvements

| ID | Fix | Effort | Priority |
|----|-----|--------|----------|
| IMP-07 | Real-time processing progress (polling) | 3h | 🟡 Medium |
| IMP-08 | Apply fontSize/readingMode to DOM | 1h | 🟡 Medium |
| IMP-09 | Dynamic model name in StatusBar | 30m | 🟢 Low |
| IMP-10 | Fix sidebar Learn section navigation | 2h | 🟡 Medium |
| IMP-11 | Load chat history from database | 3h | 🟡 Medium |
| IMP-12 | Pre-warm embedding model at startup | 1h | 🟠 High |
| IMP-13 | Export include/exclude toggles wiring | 2h | 🟢 Low |
| IMP-14 | Retry button in ProcessingModal | 1h | 🟢 Low |
| IMP-15 | DocumentCard export action | 30m | 🟢 Low |

---

## Frontend Bugs (F-01 to F-10)

| ID | Component | Bug | Severity |
|----|-----------|-----|----------|
| F-01 | Sidebar | Learn/Tools nav items all navigate to 'library' | Medium |
| F-02 | StatusBar | Model name hardcoded "Qwen 2.5 (0.5B)" | Low |
| F-03 | DocumentCard | Export action does nothing | High |
| F-04 | ExportDialog | Include/exclude toggles not sent to backend | Medium |
| F-05 | FlashcardReview | `rotateY-180` Tailwind class may be missing | High |
| F-06 | ProcessingModal | Retry button has no onClick handler | Medium |
| F-07 | SearchModal | No semantic search — title filter only | High |
| F-08 | SettingsDrawer | fontSize + readingMode not applied to DOM | Medium |
| F-09 | NotesTab | No save button — edits lost on navigation | Low |
| F-10 | documentStore | removeDocument doesn't delete from SQLite/FAISS | High |

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Idle RAM (no models) | <500 MB | ~200 MB |
| AI inference RAM | <3 GB (Basic) | ~2 GB |
| Startup time | <3 seconds | ~2-3s |
| CPU inference only | ✅ | ✅ |
| Responsive UI during AI | ✅ | Partial |

---

## Testing Checklist

- [ ] App startup (cold + warm)
- [ ] Navigation (sidebar, tabs, back)
- [ ] Theme toggle (light/dark/system)
- [ ] Window resize (900x600 minimum)
- [ ] Import PDF
- [ ] Import image
- [ ] OCR
- [ ] Markdown generation
- [ ] Notes display + edit + save
- [ ] Flashcard generation + review + flip + rate
- [ ] Quiz generation + answer + score
- [ ] AI chat + loading state
- [ ] Semantic search
- [ ] Export (all 5 formats)
- [ ] Document delete
- [ ] Settings (font size, reading mode)
- [ ] Model loading
- [ ] Error handling + recovery
- [ ] Memory usage

---

## Coding Standards

- **Python:** 3.13+, PEP 8, lazy imports, no placeholder implementations
- **TypeScript:** Strict mode, Zustand for state, TailwindCSS v4
- **Rust:** Tauri 2, serde for JSON
- **No placeholder/mock implementations** — every feature runs real local processing
- **Frontend preservation** — never redesign, never remove components
- **Backend-first** — make backend satisfy frontend, not the reverse

---

## MVP Philosophy

A stable MVP is more valuable than many unfinished features.
- Quality over quantity
- Never sacrifice stability for additional features
- A smaller feature set that works reliably > larger feature set with broken functionality
- The final submission should feel like a complete product, not a prototype

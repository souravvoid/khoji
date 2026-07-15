# Khoji — Visual Architecture

## Repository Structure

```
Khoji Root
├── Frontend (React 19 + TS + Vite)
│   ├── App.tsx              → Root, routing, theme, file upload
│   ├── Components/
│   │   ├── chat/            → ChatInput, ChatMessage, ChatPanel (streaming)
│   │   ├── document/        → Workspace, Tabs (Notes, Flashcards, Quiz, Timeline, MindMap), Export
│   │   ├── layout/          → AppShell, Sidebar, TopBar, StatusBar
│   │   ├── library/         → LibraryView, DocumentCard, UploadZone
│   │   ├── processing/      → ProcessingModal (streaming progress), PipelineVisualization
│   │   ├── review/          → FlashcardReview, RatingButtons, ReviewStats
│   │   ├── search/          → SearchModal, SearchResultItem
│   │   ├── settings/        → SettingsDrawer, ModelCard, ModelManager
│   │   └── ui/              → 13 reusable primitives
│   ├── Stores/              → uiStore, documentStore, chatStore, settingsStore, reviewStore
│   └── lib/                 → ipc.ts (invoke + streaming), keyboard.ts, constants.ts
│
├── Rust Shell (Tauri v2)
│   ├── lib.rs               → 20+ Tauri commands, Python bridge, streaming helpers
│   └── main.rs              → Entry point
│
├── Python Engine (khoji_engine)
│   ├── main.py              → IPC loop + streaming dispatch
│   ├── handlers.py          → Action dispatch table + streaming handlers
│   ├── ai/
│   │   ├── embeddings.py    → sentence-transformers (384-dim)
│   │   ├── llm.py           → llama-cpp-python (Qwen GGUF)
│   │   └── vector_search.py → FAISS IndexFlatIP
│   ├── database/db.py       → SQLite CRUD
│   └── pipeline/
│       ├── processor.py     → Orchestrator
│       ├── pdf_extractor.py → PyMuPDF
│       ├── docx_extractor.py
│       ├── pptx_extractor.py
│       ├── epub_extractor.py
│       ├── ocr.py           → RapidOCR + Tesseract
│       ├── markdown_generator.py
│       ├── content_generator.py  → Flashcards + Quiz (rule-based)
│       ├── structure_generator.py → Timeline + MindMap
│       └── exporter.py      → 8 format export
│
├── Scripts/                 → build-linux.sh, run-dev.sh, download-models.py, verify.sh
└── Docs/                    → Context, diagrams, analysis, decisions, roadmap
```

## AI Pipeline (Document Ingestion)

```
PDF/DOCX/PPTX/EPUB/Image
         │
         ▼
┌──────────────────┐
│  Route by ext    │
│  (processor.py)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐     ┌─────────────┐
│  Text Extract    │────▶│  OCR Fallback│
│  (PyMuPDF/docx/  │     │  (RapidOCR→ │
│   pptx/epub)     │     │  Tesseract) │
└──────┬───────────┘     └─────────────┘
       │
       ▼
┌──────────────────┐
│  Markdown Gen    │
│  (heading detect)│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Chunking        │
│  (1000c / 200c   │
│   overlap)       │
└──────┬───────────┘
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
┌──────────────────┐            ┌──────────────────────┐
│  Embedding       │            │  Content Gen (rule)   │
│  (all-MiniLM-L6) │            │  Flashcards (20)      │
│  → 384-dim       │            │  Quiz MCQ (10)        │
└──────┬───────────┘            └──────────┬───────────┘
       │                                   │
       ▼                                   ▼
┌──────────────────┐            ┌──────────────────────┐
│  FAISS Store     │            │  SQLite DB           │
│  (IndexFlatIP)   │            │  documents, chunks,  │
│  ~/.khoji/vectors│            │  notes, flashcards,  │
└──────────────────┘            │  quiz, chat_sessions │
                                └──────────────────────┘
```

## AI Pipeline (Chat / Search)

```
User Query (Chat or Search)
         │
         ▼
┌──────────────────┐
│  Embed Query     │
│  (same model)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  FAISS Search    │
│  top-5 chunks    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Build Prompt    │
│  (query + chunks)│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  LLM Inference   │
│  (Qwen GGUF)     │
│  → stream tokens │
│  via NDJSON      │
└──────┬───────────┘
       │
       ▼
  Frontend renders
  token-by-token
```

## IPC Flow (Streaming)

```
Frontend (React)
   │
   ├── invoke('chat_stream', { query })
   │         │
   │         ▼
   ├── Tauri command → Rust lib.rs
   │         │
   │         ▼
   ├── Python: llm.generate_stream() → per-token NDJSON
   │         │
   │         ▼
   ├── Rust: read_stream() → emit("stream-token")
   │         │
   │         ▼
   └── Frontend: listen("stream-token") → ChatPanel accumulates tokens
```

## Data Flow (Startup)

```
Tauri launches
    │
    ▼
main.rs → lib.rs::run()
    │
    ├── start_python_engine()
    │   ├── Find python3/python
    │   ├── Resolve khoji_engine/main.py path
    │   └── Spawn: python3 -m khoji_engine.main
    │
    ├── Python starts → embedding model pre-warm (background)
    │   └── Emit: {"type":"ready"}
    │
    ├── Rust reads handshake → Tauri builder
    │
    ├── Tauri creates window → loads React
    │
    └── React mounts → IPC get_documents → Library renders
```

## Database Schema

```
┌──────────────┐       ┌──────────────┐
│  documents   │──┐    │   chunks     │
│  id (UUID)   │  │    │  id          │
│  filename    │  ├───▶│  document_id │
│  title       │  │    │  content     │
│  file_path   │  │    │  chunk_index │
│  file_size   │  │    │  page_number │
│  page_count  │  │    └──────────────┘
│  status      │  │
│  created_at  │  │    ┌──────────────────┐
│  updated_at  │  │    │  notes           │
└──────────────┘  ├───▶│  id              │
                  │    │  document_id(UNQ)│
                  │    │  content         │
                  │    │  word_count      │
                  │    │  created_at      │
                  │    │  updated_at      │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  ├───▶│  flashcards      │
                  │    │  id              │
                  │    │  document_id     │
                  │    │  front           │
                  │    │  back            │
                  │    │  card_type       │
                  │    │  difficulty      │
                  │    │  tags            │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  ├───▶│  quiz_questions  │
                  │    │  id              │
                  │    │  document_id     │
                  │    │  question        │
                  │    │  options (JSON)  │
                  │    │  correct_answer  │
                  │    │  explanation     │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  └───▶│  chat_sessions   │
                       │  id              │
                       │  document_id     │
                       │  title           │
                       │  messages (JSON) │
                       │  created_at      │
                       │  updated_at      │
                       └──────────────────┘
```

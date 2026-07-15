# Khoji — Project Overview

## What Is Khoji?

Khoji is an **offline-first AI-powered knowledge workspace** desktop application. It lets users drop in documents (PDF, DOCX, PPTX, EPUB, images) and provides:

- **Text extraction** from multiple document formats with OCR fallback
- **Semantic search** using embeddings + FAISS vector search
- **AI-powered chat** using local LLM models (no cloud required)
- **Study tools**: flashcard generation, quiz generation, timeline extraction, mind map generation
- **Markdown notes** editor with preview
- **Multi-format export**: Markdown, HTML, JSON, Anki, CSV, Mermaid, Flashcard, Quiz
- **100% offline** — no telemetry, no cloud dependency, no data leaves the machine

**Version**: 1.0.0  
**License**: GNU General Public License v3.0 (GPLv3)  
**Platform**: Linux AppImage (primary), with Tauri supporting Windows/macOS  

## Problem It Solves

Most AI-powered document tools require cloud APIs (OpenAI, Google, etc.), meaning sensitive documents must be uploaded to external servers. Khoji runs entirely on the user's machine:

- Students can process lecture PDFs into flashcards and quizzes without internet
- Researchers can search across document collections semantically
- Professionals can extract timelines and mind maps from reports locally
- Privacy-sensitive users get NotebookLM-like features without data exposure

## Target Users

| User | Use Case |
|------|----------|
| Students | Process lecture notes → flashcards, quizzes, mind maps |
| Researchers | Semantic search across paper collections, timeline extraction |
| Professionals | Extract knowledge from reports, generate study materials |
| Privacy-conscious users | AI document analysis without cloud dependency |
| Developers | Extensible engine with IPC protocol for custom integrations |

## Key Differentiators

| Feature | Khoji | NotebookLM | AnythingLLM | Khoj |
|---------|-------|------------|-------------|------|
| Desktop native | ✓ | ✗ (web) | ✗ (Electron) | ✗ (server) |
| Fully offline | ✓ | ✗ | Partial | ✗ |
| OCR | ✓ | ✗ | ✗ | ✗ |
| Flashcards | ✓ | ✓ | ✗ | ✗ |
| Quizzes | ✓ | ✓ | ✗ | ✗ |
| Timelines | ✓ | ✗ | ✗ | ✗ |
| Mind maps | ✓ | ✓ | ✗ | ✗ |
| Local LLM | ✓ | ✗ | ✓ | ✓ |
| No account needed | ✓ | ✗ | ✓ | ✗ |
| Open source | ✓ (GPLv3) | ✗ | ✓ (MIT) | ✓ (GPLv3) |

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Tauri v2 (Rust) | Window management, file dialogs, process spawning |
| Frontend | React 19 + TypeScript + Vite | UI, state management, component library |
| Styling | Tailwind CSS v4 + CSS tokens | BMW M-inspired "industrial precision" design |
| State | Zustand (5 stores) | Lightweight React state management |
| Backend | Python 3.14 | AI engine, document processing, database |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | 384-dim semantic vectors |
| Vector search | FAISS (IndexFlatIP) | Cosine similarity search |
| LLM | llama-cpp-python (Qwen2.5 GGUF) | Local language model inference |
| Database | SQLite (WAL mode) | Document metadata, notes, flashcards, quizzes, chat |
| PDF | PyMuPDF | Text extraction from PDFs |
| OCR | RapidOCR / Tesseract | Fallback text extraction from images |
| Testing | Playwright (E2E), pytest (backend) | Automated testing |

## Data Storage

All data lives at `~/.khoji/`:

```
~/.khoji/
├── khoji.db           # SQLite database (7 tables)
├── vectors/
│   ├── vectors.index  # FAISS vector index
│   └── metadata.json  # Chunk metadata for vectors
└── models/
    ├── qwen2.5-0.5b-instruct-q4_k_m.gguf
    ├── qwen2.5-1.5b-instruct-q4_k_m.gguf
    ├── SmolLM2-1.7B-Instruct-Q4_K_M.gguf
    └── tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
```

## Project Structure

```
hackathon/
├── backend/python/          # Python AI engine
│   └── khoji_engine/        # Main package
│       ├── ai/              # Embeddings, LLM, vector search
│       ├── database/        # SQLite operations
│       ├── pipeline/        # Document processing pipeline
│       ├── handlers.py      # IPC action dispatch (20 handlers)
│       └── main.py          # Subprocess entry point
├── frontend/                # React + Tauri desktop app
│   ├── src/                 # React/TypeScript source
│   │   ├── components/      # 31 React components
│   │   ├── stores/          # 5 Zustand stores
│   │   └── lib/             # IPC layer, constants, keyboard
│   └── src-tauri/           # Rust desktop shell
│       └── src/lib.rs       # Tauri commands + Python bridge
├── scripts/                 # Build, dev, verification scripts
└── docs/                    # Documentation
```

## Quick Start

```bash
# Development
./scripts/run-dev.sh

# Production build (AppImage)
./scripts/build-linux.sh

# Download AI models
python3 scripts/download-models.py

# Run backend tests
cd backend/python && ./verify.sh
```

# Khoji — Offline AI Knowledge Workspace

**Version 1.0.0**

Khoji is an offline-first AI-powered knowledge workspace. Drop in PDFs, DOCX, PPTX, EPUB, or images — it extracts text, builds semantic search, generates flashcards and quizzes, creates timelines and mind maps, and lets you chat with your documents — all running locally with no internet required.

## Features

- **Multi-format ingestion** — PDF, DOCX, PPTX, EPUB, images (with OCR fallback)
- **Semantic search** — all-MiniLM-L6-v2 embeddings + FAISS vector search
- **AI study tools** — rule-based flashcards (20/doc), quiz generation (10 MCQ/doc)
- **Visual maps** — timeline extraction and Mermaid mind maps
- **LLM chat** — RAG-powered Q&A (Qwen 0.5B/1.5B GGUF models)
- **8 export formats** — Markdown, HTML, JSON, Anki, CSV, Mermaid, Flashcard, Quiz
- **100% offline** — no telemetry, no cloud dependency

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Vite + Zustand + Tailwind v4 |
| AI Engine | Python 3.14, sentence-transformers, FAISS, llama-cpp-python |
| Database | SQLite (7 tables, WAL mode, cascade deletes) |
| UI Tests | Playwright (Chromium + Firefox) |

## Quick Start

### Download

Grab the latest **AppImage** from the [Releases](https://github.com/souravvoid/khoji/releases) page:

```bash
chmod +x Khoji_1.0.0_amd64.AppImage
./Khoji_1.0.0_amd64.AppImage
```

SHA256 checksums are published alongside each release.

### Build from Source

```bash
# Install system dependencies (Fedora)
sudo dnf install webkit2gtk4.1-devel libxdo-devel openssl-devel

# Backend
cd backend/python
uv sync --extra dev
uv run python verify_ipc.py

# Frontend + AppImage
cd frontend
npm install
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npx tauri build --bundles appimage
```

## Verification

After any backend change, run:

```bash
cd backend/python && ./verify.sh
```

This runs: ruff lint → import smoke → IPC action verification → engine E2E tests.

## Project Structure

```
khoji/
├── backend/python/
│   ├── khoji_engine/          # Python AI engine
│   │   ├── ai/                # Embeddings, LLM, vector search
│   │   ├── pipeline/          # Extraction, generation, export
│   │   ├── database/          # SQLite persistence
│   │   ├── handlers.py        # IPC action dispatch
│   │   └── main.py            # Subprocess entry point
│   ├── tests/                 # Engine E2E tests
│   └── verify.sh              # Backend verification suite
├── frontend/
│   ├── src/                   # React + TypeScript app
│   ├── src-tauri/             # Tauri (Rust) desktop shell
│   └── tests/e2e/             # Playwright UI tests
├── scripts/
│   └── build-linux.sh         # Automated AppImage builder
└── docs/
```

## License

GNU General Public License v3.0

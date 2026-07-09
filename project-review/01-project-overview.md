# 01 — KHOJI: Project Overview

> **Project Name:** Khoji  
> **Tagline:** Offline AI Knowledge Workspace  
> **Event:** OSDHack 2026  
> **Version:** 1.0.0  
> **Status as of 2026-07-07:** Functional MVP with AI pipeline fully wired

---

## 1. Vision

Khoji (meaning "explorer" or "seeker" in Urdu/Hindi) transforms documents into **structured, queryable knowledge** — entirely offline, without cloud APIs, without subscriptions, without sending data anywhere.

The core promise:

> Drop a PDF → get Markdown notes, flashcards, a quiz, a mind map, a timeline, and a chat interface — all generated locally on your machine.

This is particularly valuable for:
- Students reviewing textbooks
- Researchers analysing papers
- Professionals reading technical documentation
- Anyone who values privacy

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     KHOJI Application                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Tauri 2 Shell                          │  │
│  │  (Rust binary — system integration, IPC bridge)          │  │
│  │                                                           │  │
│  │   ┌─────────────────────┐   ┌────────────────────────┐  │  │
│  │   │   React Frontend    │   │   Python AI Engine     │  │  │
│  │   │   (Vite + TSX)      │◄──►   (subprocess/stdin)   │  │  │
│  │   │                     │   │                        │  │  │
│  │   │  Zustand stores     │   │  PyMuPDF (PDF)         │  │  │
│  │   │  TailwindCSS v4     │   │  RapidOCR / Tesseract  │  │  │
│  │   │  lucide-react       │   │  sentence-transformers │  │  │
│  │   │  react-markdown     │   │  FAISS vector search   │  │  │
│  │   │  framer-motion      │   │  llama-cpp-python      │  │  │
│  │   │                     │   │  SQLite database       │  │  │
│  │   └─────────────────────┘   └────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

IPC Protocol: JSON over stdin/stdout (synchronous request-response)
Database: SQLite at ~/.khoji/khoji.db
Vectors: FAISS IndexFlatIP at ~/.khoji/vectors/
Models: GGUF files at ~/.khoji/models/
```

### Why this architecture?

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | Tauri 2 (Rust) | Native, tiny binary (~6MB), cross-platform, secure IPC |
| Frontend | React 19 + Vite 8 | Modern, fast HMR, rich ecosystem |
| Styling | TailwindCSS v4 + CSS tokens | Rapid iteration, design system tokens |
| AI runtime | Python subprocess | Ecosystem richness (PyTorch, llama.cpp, FAISS) |
| IPC | JSON over stdin/stdout | Simple, no networking, no port conflicts |
| Database | SQLite | Embedded, zero server, ACID, proven |
| Vector index | FAISS IndexFlatIP | CPU-only, no GPU needed, persisted as file |
| LLM | llama-cpp-python GGUF | Quantised inference, fits in 8GB RAM |
| Embeddings | all-MiniLM-L6-v2 (80MB) | Best quality/size ratio for semantic search |
| OCR | RapidOCR → Tesseract | Two-engine fallback for robustness |

---

## 3. End-to-End Workflow

```
User selects file (PDF/DOCX/PPTX/EPUB/Image)
         │
         ▼
Tauri dialog (native file picker)
         │
         ▼
Python process_document_sync()
         │
         ├── PDF extraction (PyMuPDF)
         │     └── OCR fallback (RapidOCR → Tesseract) for image-only PDFs
         │
         ├── DOCX/PPTX/EPUB extraction (specialised extractors)
         │
         ├── Markdown generation (rule-based, heading detection)
         │
         ├── Text chunking (1000-char overlapping windows)
         │
         ├── Embedding generation (sentence-transformers, 384-dim)
         │
         ├── FAISS vector index (persisted to disk)
         │
         ├── Flashcard generation (definition/fact extraction, rule-based)
         │
         └── Quiz generation (MCQ with distractors, rule-based)
                    │
                    ▼
         SQLite: documents, chunks, notes, flashcards, quiz_questions
                    │
                    ▼
         Frontend: Library view → Document Workspace
                    │
                    ├── Notes tab (Markdown rendered with react-markdown)
                    ├── Flashcards tab (spaced repetition UI)
                    ├── Quiz tab (interactive MCQ with scoring)
                    ├── Mind Map tab (custom SVG canvas)
                    ├── Timeline tab (chronological event extraction)
                    └── AI Chat panel (LLM with document context)
```

---

## 4. Design Philosophy

The UI follows a **BMW M-inspired industrial design system**:
- **Black canvas** `#000000` (dark) / **white** `#ffffff` (light)
- **M tricolor stripe** (light blue → dark blue → red) as brand accent
- **Zero border radius** — industrial precision corners
- **Inter font** (Latin fallback from BMWTypeNextLatin spec)
- **Uppercase labels, tracked spacing** — engineered, not decorative

This gives Khoji a premium, distinctive identity that stands out from generic productivity tools.

---

## 5. Current Status (2026-07-07)

### ✅ Fully Implemented
- Full document pipeline (PDF, DOCX, PPTX, EPUB, images)
- OCR fallback chain (RapidOCR → Tesseract)
- Markdown note generation
- Text chunking & FAISS embeddings
- SQLite schema with all tables
- Flashcard generation (rule-based)
- Quiz generation (rule-based MCQ)
- Timeline extraction (date-regex based)
- Mind map / Mermaid generation
- Export system (Markdown, HTML, JSON, Anki, Mermaid, CSV)
- AI Chat (LLM with document context, model not pre-loaded)
- Settings drawer (theme, fonts, keyboard shortcuts, model manager)
- Search modal (currently document-title-only filter)
- Tauri IPC bridge (all 16 commands registered)
- Dark/Light theme with system detection
- Keyboard shortcuts (⌘K, ⌘,, ⌘B, ⌘D, ⌘1)

### 🟡 Partially Working
- Semantic search (FAISS in backend but SearchModal does title-filter only)
- AI Chat (LLM loaded on demand; no model pre-loaded means first response is slow)
- Document delete (frontend removes from store, no cascade to FAISS yet)
- Processing progress (modal shown but progress is coarse: 0→10→30→50→100)

### ❌ Not Yet Implemented
- Real streaming tokens in chat (currently sends full response at once)
- Chat history persistence to SQLite (exists in DB but not wired in frontend)
- Flashcard spaced-repetition backend sync (review exists in-memory only)
- Export "include/exclude" toggles (UI exists, not plumbed to backend)
- Retry button in ProcessingModal (button rendered but onClick is empty)
- High contrast / Reduced motion settings (toggles exist but non-functional)
- Status bar CPU/RAM live metrics (static "CPU" label)

---

## 6. Performance Baseline (Tested on Fedora Linux, Intel i5-12th Gen, 8GB RAM)

| Metric | Value |
|---|---|
| Python engine startup | ~66 seconds (sentence-transformers model load) |
| Embedding model size | 80MB (all-MiniLM-L6-v2) |
| LLM (Qwen 2.5 0.5B) | 469MB on disk, ~500MB RAM |
| LLM (Qwen 2.5 1.5B) | 591MB on disk, ~1.2GB RAM |
| FAISS index (63 vectors) | Instantaneous search |
| SQLite queries | <10ms |
| TypeScript compile | 0 errors |

---

## 7. Dependencies Summary

### Python (backend/python/pyproject.toml)
| Package | Version | Purpose |
|---|---|---|
| PyMuPDF | ≥1.25 | PDF extraction |
| numpy | ≥2.0 | Array ops |
| sentence-transformers | ≥3.0 | Embeddings |
| faiss-cpu | ≥1.9 | Vector search |
| llama-cpp-python | ≥0.3 | Local LLM |
| python-docx | ≥1.1 | DOCX parsing |
| python-pptx | ≥1.0 | PPTX parsing |
| EbookLib | ≥0.18 | EPUB parsing |
| rapidocr-onnxruntime | ≥1.0 | OCR (optional) |

### TypeScript (frontend1/package.json)
| Package | Version | Purpose |
|---|---|---|
| @tauri-apps/api | ^2.11 | Tauri IPC |
| @tauri-apps/plugin-dialog | ^2.7 | Native file picker |
| react | ^19.2 | UI framework |
| zustand | ^5.0 | State management |
| framer-motion | ^12.42 | Animations |
| lucide-react | ^1.23 | Icons |
| react-markdown | ^10.1 | Markdown rendering |
| remark-gfm | ^4.0 | GFM tables/lists |
| tailwindcss | ^4.3 | CSS framework |

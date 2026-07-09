# 02 — Folder Structure Analysis

> Every directory explained — what it is, why it exists, what it depends on.

---

## Root Layout

```
hackathon/
├── backend/           Python AI engine
├── frontend/          Unused skeleton (empty src-tauri/src)
├── frontend1/         Active Tauri + React application  ← MAIN
├── scripts/           Developer utilities
└── ui/                Design reference screenshots (PNG mockups)
```

**Key observation:** There are two frontend directories. `frontend/` was the original scaffold (now empty/unused). `frontend1/` is the active, fully-implemented application. The scripts reference `frontend/` (an old path). This is a naming inconsistency that must be fixed before packaging.

---

## `/backend/`

```
backend/
└── python/
    ├── pyproject.toml          Package manifest (PEP 621)
    ├── uv.lock                 Locked dependency tree (uv package manager)
    ├── .venv/                  Virtual environment (git-ignored)
    └── khoji_engine/           Main Python package
        ├── __init__.py
        ├── main.py             Entry point — stdin/stdout IPC loop
        ├── ai/                 AI subsystem
        │   ├── embeddings.py   sentence-transformers wrapper (all-MiniLM-L6-v2)
        │   ├── llm.py          llama-cpp-python wrapper (GGUF models)
        │   └── vector_search.py FAISS IndexFlatIP store
        ├── database/
        │   └── db.py           SQLite schema + all CRUD operations
        ├── export/
        │   └── __init__.py     (empty, export logic lives in pipeline/)
        └── pipeline/
            ├── content_generator.py  Flashcard + Quiz generation (rule-based)
            ├── docx_extractor.py     .docx → ExtractionResult
            ├── epub_extractor.py     .epub → ExtractionResult
            ├── exporter.py           All export formats (MD, HTML, JSON, Anki, Mermaid)
            ├── markdown_generator.py text → structured Markdown + chunking
            ├── ocr.py               RapidOCR → Tesseract fallback chain
            ├── pdf_extractor.py     PyMuPDF text extraction
            ├── pptx_extractor.py    .pptx → ExtractionResult
            ├── processor.py         Master orchestrator for the full pipeline
            └── structure_generator.py Timeline + MindMap + Mermaid generation
```

### Why this layout?
- **Separate `ai/`** isolates model-related code (easy to swap models)
- **`pipeline/`** contains all document processing — linear orchestration
- **`database/`** is a pure data layer with no business logic
- **`export/`** is currently empty (exports are in pipeline/exporter.py — naming debt)

### Dependencies
- `main.py` imports from all other modules lazily (inside handlers)
- `processor.py` is the central orchestrator, calling all pipeline modules
- `db.py` has no dependencies within the package
- `vector_search.py` depends on `embeddings.py` for query embedding

---

## `/frontend1/` (Active Application)

```
frontend1/
├── DESIGN.md               BMW M-design specification (504 lines)
├── README.md               Brief project readme
├── index.html              Root HTML entry point
├── package.json            npm manifest
├── vite.config.ts          Vite build config (React + TailwindCSS plugin)
├── tsconfig.json           TypeScript project references
├── tsconfig.app.json       App TypeScript config (strict mode, bundler resolution)
├── tsconfig.node.json      Node tools TypeScript config
├── .oxlintrc.json          oxlint configuration (linter)
├── dist/                   Built frontend (git-ignored)
├── node_modules/           npm packages (git-ignored)
├── public/                 Static assets
├── src/
│   ├── main.tsx            React entry point (StrictMode, App mounting)
│   ├── App.tsx             Root component — routing logic, document load
│   ├── index.css           Global styles (imports Tailwind + tokens)
│   ├── assets/             hero.png, react.svg, vite.svg
│   ├── components/
│   │   ├── chat/           ChatInput, ChatMessage, ChatPanel
│   │   ├── document/       DocumentWorkspace, ExportDialog, FlashcardsTab,
│   │   │                   MindMapTab, NotesTab, OutlinePanel, QuizTab,
│   │   │                   TimelineTab
│   │   ├── layout/         AppShell, Sidebar, StatusBar, TopBar
│   │   ├── library/        DocumentCard, LibraryView, UploadZone
│   │   ├── processing/     PipelineVisualization, ProcessingModal
│   │   ├── review/         FlashcardReview, RatingButtons, ReviewStats
│   │   ├── search/         SearchModal, SearchResultItem
│   │   ├── settings/       ModelCard, ModelManager, SettingsDrawer
│   │   └── ui/             Badge, Button, Card, Dropdown, EmptyState,
│   │                       IconButton, Input, Modal, ProgressBar,
│   │                       Skeleton, Spinner, Tabs, Toggle
│   ├── hooks/
│   │   └── useKeyboard.ts  Global keyboard shortcut handler
│   ├── lib/
│   │   ├── constants.ts    App constants (formats, stages, shortcuts)
│   │   ├── ipc.ts          Tauri invoke wrappers (all 16 commands)
│   │   └── keyboard.ts     Keyboard utility (placeholder)
│   ├── pages/              EMPTY — routing is inline in App.tsx
│   ├── stores/             Zustand state management
│   │   ├── chatStore.ts    Chat sessions and messages
│   │   ├── documentStore.ts Documents list and processing queue
│   │   ├── reviewStore.ts  Flashcard review session state
│   │   ├── settingsStore.ts App settings and model list
│   │   └── uiStore.ts      Theme, sidebar, modal visibility, active view
│   └── styles/
│       └── tokens.css      CSS custom properties (colors, shadows, timing)
└── src-tauri/
    ├── Cargo.toml          Rust package (tauri, serde, serde_json)
    ├── build.rs            Tauri build script
    ├── tauri.conf.json     Tauri app config (window size, CSP, bundle targets)
    ├── capabilities/       Tauri 2 permission system (auto-generated)
    ├── icons/              App icons (PNG, ICO, ICNS)
    └── src/
        ├── lib.rs          All Tauri commands + Python engine manager
        └── main.rs         Entry point (calls lib::run())
```

### Component Hierarchy
```
App.tsx
└── AppShell (layout wrapper)
    ├── Sidebar (navigation)
    ├── TopBar (search trigger, upload button)
    ├── main (content area)
    │   ├── UploadZone (when showUpload=true)
    │   ├── DocumentWorkspace (when currentView='document')
    │   │   ├── Tabs [notes, flashcards, quiz, mindmap, timeline]
    │   │   ├── NotesTab
    │   │   ├── FlashcardsTab → FlashcardReview (full-screen)
    │   │   ├── QuizTab
    │   │   ├── MindMapTab
    │   │   ├── TimelineTab
    │   │   ├── ChatPanel (when chatOpen=true)
    │   │   └── ExportDialog (modal)
    │   └── LibraryView (default)
    │       └── DocumentCard × N
    ├── StatusBar (doc count, model status)
    ├── SearchModal (overlay)
    ├── SettingsDrawer (overlay)
    └── ProcessingModal (overlay, when queue > 0)
```

---

## `/scripts/`

```
scripts/
├── build-linux.sh       Build AppImage for Linux
├── clean.py             Remove build artifacts, caches, DB
├── download-models.py   Download GGUF models to ~/.khoji/models/
├── run-dev.sh           Start development server (has wrong path: frontend/ not frontend1/)
└── verify-install.py    Check all dependencies and print status
```

**BUG FOUND:** Both `run-dev.sh` and `build-linux.sh` reference `frontend/` instead of `frontend1/`. This means the scripts will fail as-is.

---

## `/ui/`

```
ui/
├── 1.png through 12.png   Design reference screenshots
└── ⅓.png                  One additional reference
```

These are the original design mockups used during development. They document the intended final appearance.

---

## `/frontend/` (Dead Code)

```
frontend/
└── src-tauri/
    └── src/              EMPTY DIRECTORY
```

This is a leftover from the initial Tauri scaffold. It serves no purpose and should be removed or noted as obsolete.

---

## Dependency Graph (Backend)

```
main.py
  ├── khoji_engine.pipeline.processor ──► pdf_extractor
  │                                  ──► docx_extractor
  │                                  ──► pptx_extractor
  │                                  ──► epub_extractor
  │                                  ──► ocr
  │                                  ──► markdown_generator
  │                                  ──► content_generator
  │                                  ──► ai.embeddings
  │                                  ──► ai.vector_search
  │                                  ──► database.db
  ├── khoji_engine.ai.vector_search ──► ai.embeddings
  ├── khoji_engine.ai.llm
  ├── khoji_engine.database.db
  └── khoji_engine.pipeline.exporter ──► database.db
```

**All imports in `main.py` are lazy** (inside each `elif` handler block). This means:
1. Startup is fast — only stdlib is imported at module level
2. Import errors only surface when that specific action is first called
3. This is intentional for subprocess startup speed

---

## Dependency Graph (Frontend)

```
App.tsx
  ├── stores/uiStore ──► localStorage (theme persistence)
  ├── stores/documentStore
  ├── lib/ipc ──► @tauri-apps/api/core (invoke)
  ├── hooks/useKeyboard ──► stores/uiStore
  └── components/* ──► stores/* + lib/ipc
```

**State flows unidirectionally:** IPC calls → Zustand stores → React re-renders.

No prop drilling beyond one level. Each component reads directly from relevant store.

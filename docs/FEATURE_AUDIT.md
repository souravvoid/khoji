# Feature Audit — Khoji v1.0.0

Per-feature status. Status values: **PASS** · **PARTIAL** · **BROKEN** · **STUB**.

| # | Feature | Purpose | Current implementation | Status | Needs improvement | Priority | Owner modules | Risk |
|---|---------|---------|----------------------|--------|----------------------|----------|---------------|------|
| 1 | PDF Import | Ingest PDF → study material | `pdf_extractor` (PyMuPDF) per-page try/except | PASS | Better error msg on missing lib | Low | `pipeline/pdf_extractor.py` | Low |
| 2 | DOCX/PPTX/EPUB Import | Ingest Office/ePub | `docx_extractor`/`pptx_extractor`/`epub_extractor`, ImportError-guarded | PARTIAL | ImportError path ignored by processor → misleading "no text" msg | Med | `pipeline/extractors/*` | Med |
| 3 | Image Import | OCR images | `processor.py:54-63` image branch → OCR | PARTIAL | Re-uses PDF OCR fallback awkwardly | Low | `pipeline/processor.py` | Low |
| 4 | Plain-text Import | `.txt/.md/.html/.csv` | **raises ValueError** | BROKEN | Support text/markdown/html directly | Med | `pipeline/processor.py:51-52` | Med |
| 5 | OCR | Scanned → text | RapidOCR (ONNX) → Tesseract CLI fallback | PASS | None critical | Low | `pipeline/ocr.py` | Low |
| 6 | Markdown Notes | AI/rule notes per doc | Generated in pipeline; NotesTab preview+edit (blur-save) | PARTIAL | `editContent` not reset on doc switch → stale text | Med | `components/document/NotesTab.tsx:14` | Med |
| 7 | Flashcards | Study cards | Rule-based `content_generator`; FlashcardsTab + Review | PARTIAL | **Duplicate rows on repeat generate**; no spaced rep | Med | `handlers.py:79-97`, `content_generator.py` | Med |
| 8 | Quiz | MCQ quiz | Rule-based generator; QuizTab flow | PARTIAL | **Duplicate rows on repeat**; distractor can be negative | Med | `handlers.py:100-121`, `content_generator.py:162` | Med |
| 9 | Timeline | Date events | Regex `19xx`/`20[0-2]x` | PARTIAL | **Empty for BC / pre-1900 / post-2029** | Med | `pipeline/structure_generator.py:9-13` | Med |
| 10 | Mind-map | Concept tree | Mermaid from `##` headings; MindMapTab | BROKEN | Parser **ignores edges → flat list, not a tree** | High | `components/document/MindMapTab.tsx:8-30` | High |
| 11 | AI Chat (multi-turn) | Doc Q&A | `chat_stream` + `generate_stream(history)`; DB persistence; session switcher | PARTIAL | New/unsent + sibling sessions not flushed on reload; global `stream-token` listener | Med | `handlers.py:327`, `ChatPanel.tsx` | Med |
| 12 | Semantic Search | Find relevant chunks | FAISS `IndexFlatIP`; SearchModal debounced | PARTIAL | No keyboard result selection (hint misleading); empty-result UX untested | Med | `ai/vector_search.py`, `SearchModal.tsx` | Low |
| 13 | Export | Multi-format out | md/html/json/anki/quiz_json/csv/mermaid | PARTIAL | **Include Notes/Flashcards/Quiz toggles are dead UI**; writes `~/Documents` with fixed names (overwrites); CSV ignores doc_id | Med | `exporter.py`, `ExportDialog.tsx` | Med |
| 14 | Library Export | Export from card | LibraryView → ExportDialog | BROKEN | Navigates to doc, unmounts LibraryView → dialog never opens (`exportDocId` dead) | High | `LibraryView.tsx:45-56`, `App.tsx:184` | High |
| 15 | Theme (light/dark/system) | Appearance | `uiStore.initTheme` sets `data-theme` | PASS | Reading-mode + font-size settings have no visual effect | Med | `index.css`, `tokens.css` | Med |
| 16 | Sidebar nav | Section switch | Only "Documents" switches; others are stubs | STUB | Flashcards/Quiz/MindMaps/Timeline/Chat don't switch views | Med | `components/layout/Sidebar.tsx:36` | Med |
| 17 | Settings | Prefs | Drawer; model manager download | PARTIAL | Accessibility toggles dead; shortcuts doc wrong (1-4 vs A-D); no focus trap | Low | `SettingsDrawer.tsx` | Low |
| 18 | Streaming IPC | No-UI-freeze chat/progress | `chat_stream` emits `stream-token`; `process_document_stream` emits `progress-update` | PASS | None (core demo enabler) | Low | `lib.rs`, `handlers.py`, `ipc.ts` | Low |
| 19 | Model download | Fetch GGUF | `handle_download_model` → `llm.ensure_model` | BROKEN | **Always reports success even when download failed** | High | `handlers.py:239-241` | High |
| 20 | Auto model-select | Pick model by RAM | `detect_hardware()` | DEAD | Never called; always defaults qwen2.5-0.5b | Low | `llm.py:85-104` | Low |

## Summary
- **PASS (5):** PDF import, OCR, Theme, Streaming IPC, (Markdown notes generation).
- **BROKEN (4):** Plain-text import, Mind-map parser, Library export, Model-download false-success.
- **PARTIAL (10):** Office/ePub, Image, Notes, Flashcards, Quiz, Timeline, Chat, Search, Export, Settings.
- **STUB (1):** Sidebar non-document sections.
- **DEAD (1):** `detect_hardware`.

Top fix priority before judging: **Model-download false-success (#19)**, **Library export (#14)**, **Mind-map (#10)**, **Export toggles (#13)** — all are visible in a live demo.

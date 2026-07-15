# QA Checklist — Khoji v1.0.0

Master pre-submission testing checklist for the OSDHack 2026 final.
Legend: `[x]` verified by harness/static review · `[~]` partial/static only · `[ ]` not verified (needs live GUI + models).

> Context: `verify_ipc.py` exercises all 22 Python handlers **with mocked** LLM/embeddings/vector store, so it does NOT cover real OCR, real embeddings, the streaming handlers, or the GUI. Live checks below require pre-staged models (see `DEMO_CHECKLIST.md` / `LOCAL_AI_VERIFICATION.md`).

## Application
- [x] Cold start launches Tauri window (verified: AppImage builds & runs)
- [x] Warm start re-opens without re-indexing (SQLite + FAISS persist on disk)
- [~] Missing models: chat returns "model not loaded" message (handlers.py:355) — but see BUG-001 (download falsely reports success)
- [~] Missing database: `~/.khoji/khoji.db` auto-creates on first `Database()` (db.py:44)
- [x] Missing folders: engine dir resolved from cwd/AppImage mount (lib.rs:67-113)
- [~] Corrupted settings: `settingsStore` has no file persistence; no settings file to corrupt

## Navigation
- [x] Every page: Library, DocumentWorkspace render
- [ ] Every button: **Sidebar Flashcards/Quiz/Mind Maps/Timeline/Chat are stubs** (Sidebar.tsx:36 `STUB_LABELS` → `showHint()` only) — they never switch views
- [x] Every menu: Settings drawer opens
- [~] Every dialog: in-document ExportDialog works; **Library export dialog never opens** (LibraryView.tsx:45-56 + App.tsx:184 unmounts LibraryView)
- [x] Keyboard shortcuts: ⌘K search, ⌘, settings, ⌘B sidebar, ⌘D dark, ⌘1 library (useKeyboard.ts)
- [~] Back navigation: DocumentWorkspace back button sets `currentView('library')` but leaves `activeDocument` stale briefly (DocumentWorkspace.tsx:29-32)
- [x] Window resizing: flex layout, min-width 900 (tauri.conf.json)

## Theme
- [x] Light / Dark / System: `uiStore.initTheme` applies `data-theme` (uiStore.ts)
- [~] Persistence: theme stored, but `matchMedia` listener never removed (leak, uiStore.ts:92-100)
- [ ] Animations: reduced-motion toggle is a **dead control** (SettingsDrawer.tsx:166 `onChange={() => {}}`)
- [ ] Reading Mode + Font Size: **zero visual effect** — `--reading-font-size` / `.reading-mode` have no CSS consumer (index.css / tokens.css); e2e only asserts the var is *set*, not applied

## Import
- [x] PDF: pdf_extractor (PyMuPDF) robust per-page (BACKEND_ANALYSIS)
- [ ] Large PDF / Scanned PDF: not live-tested
- [ ] DOCX / PPTX / EPUB: extractors guard ImportError and return `errors[]` which the processor **ignores** (processor.py) — a missing lib yields "No text could be extracted" instead of an install hint
- [ ] Images (PNG/JPG): OCR branch (processor.py:54-63)
- [ ] Invalid / corrupted / huge files: not tested
- [x] Repeated / duplicate imports: `document_exists` guard prevents re-insert (processor.py)

## OCR
- [x] Scanned image: RapidOCR (ONNX) → Tesseract fallback (ocr.py)
- [ ] Rotated / low-res / blank page / multi-column / tables / mixed language: not live-tested
- [x] Failure recovery: missing engines → empty result, no crash (ocr.py `has_ocr_engine`)

## AI Pipeline (per stage)
- [~] OCR (above)
- [~] Text cleaning → Chunking: `chunk_markdown` guarantees `chunk_index`/`content`
- [~] Embedding: `all-MiniLM-L6-v2` 384-dim; **silently swallowed on failure** → doc marked `ready` with no vectors (processor.py:87-88) — search then returns nothing
- [~] FAISS: `IndexFlatIP` at `~/.khoji/vectors`; search returns `[]` on empty/failed index (vector_search.py:79-85)
- [~] Retrieval: semantic; no live relevance scoring done
- [~] LLM: local llama-cpp; streaming emits tokens (llm.py:184-213)
- [x] Markdown: notes generated during ingestion
- [~] Flashcards / Quiz: rule-based (content_generator.py), **duplicate on repeat click** (handlers.py:79-121)
- [ ] Timeline: **empty for BC / pre-1900 / post-2029 dates** (structure_generator.py:9-13)
- [ ] Mind-map: Mermaid parser **ignores edges → flat list, not a tree** (MindMapTab.tsx:8-30)

## Search
- [x] Semantic relevance: FAISS IP search (vector_search.py)
- [ ] Ranking / highlighting / navigation / no-results / repeated: not live-tested

## Export
- [~] Markdown / HTML / JSON / Anki / Quiz-JSON / Flashcards-JSON / Mermaid / CSV: exporters exist (exporter.py)
- [ ] File naming / folder creation / permissions / overwrite / large export: **exports write to `~/Documents` with FIXED filenames and silently overwrite** (exporter.py:159-165)
- [ ] CSV export **ignores `doc_id` and exports the entire library** (exporter.py:146)

## Database
- [x] Insert / Update / Delete: parameterized (db.py)
- [x] Recovery: WAL mode; delete cascades chat_messages via FK
- [~] Duplicate records: `file_path` UNIQUE guard + `document_exists` (processor.py)
- [~] Corruption / backup: no backup tool; SQLite WAL mitigates

## Performance (target: Intel i5, 8 GB RAM, integrated GPU, Fedora)
- [~] See `PERFORMANCE_REPORT.md`. Single Python engine subprocess; pre-warm embedder thread; no engine auto-restart (lib.rs:27-29).
- [ ] Live RAM/CPU/latency not measured in this audit (no models pre-staged in CI).

## Packaging
- [x] Frontend build: `tsc -b && vite build` succeeds
- [x] Python: imports clean (`py_compile` OK)
- [x] Rust: `cargo` release build OK
- [x] AppImage: builds (`Khoji_1.0.0_amd64.AppImage`, ~105 MB, repo root) — note: required manual `appimagetool` step because tauri's `linuxdeploy` bundled `strip` can't parse modern `.relr.dyn` sections
- [~] Installer: `scripts/build-linux.sh` uses `APPIMAGE_EXTRACT_AND_RUN=1` (world-writable temp — MED) and **unsigned** artifacts (no GPG)

## Security
- [x] SQL: all parameterized (db.py)
- [x] Subprocess spawn: no shell, no injection (lib.rs:123-128)
- [x] Capabilities: minimal `core:default` + `dialog:default` (capabilities/default.json)
- [ ] File validation: **no directory containment** — any allowed-extension absolute path accepted (lib.rs:11-25)
- [ ] CSP: **disabled** (`"csp": null`, tauri.conf.json:25-27)
- [~] Prompt injection: document text concatenated unsanitized into LLM prompt (handlers.py:343-348) — LOW (local)
- [~] Crash recovery: no engine watchdog/restart; no read timeout on stdout (lib.rs)

## Documentation
- [x] README.md present (thin — missing deps/dev-run/models/sample/troubleshooting)
- [x] ARCHITECTURE.md, TECHNICAL_REPORT.md, EVALUATION.md, PRIVACY_AND_SAFETY.md, ATTRIBUTION.md, LOCAL_AI_VERIFICATION.md — created this audit
- [~] 6 internal docs (`docs/internal/*`) are STALE on streaming (now implemented); `PROJECT_CONTEXT.md` has a wrong DB-schema table name

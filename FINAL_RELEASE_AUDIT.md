# Khoji — Final Release Audit

## Executive Summary

Khoji is an offline-first AI knowledge workspace (Tauri v2 + React 19 + TypeScript + Python + Rust). The build is green, the AppImage packages, and all 22 IPC handlers pass their verification harness. The core pipeline is real and demonstrable. However, the release carries multiple functional defects and one offline-install defect that would cripple a judge's ability to evaluate the product. The verdict is **NOT READY** for submission in its current state.

## Overall Score: 54 / 100

| Dimension | Score | Weight | Note |
|-----------|-------|--------|------|
| Architecture | 16/20 | | Clean 3-layer; Mutex bottleneck; no DI |
| Frontend | 11/20 | | Good components; broken export path; dead toggles; stubs |
| Backend | 13/20 | | Solid pipeline; false-success download; duplicate rows |
| OCR | 15/15 | | Dual engine, works reliably |
| AI | 11/15 | | Streaming + multi-turn work; dead `detect_hardware` |
| Search | 9/10 | | Fast, correct |
| Database | 8/10 | | Parameterized, but duplicate-row bug |
| Performance | 13/15 | | Streaming landed; LLM cold-load slow |
| Security | 8/20 | | SQL/spawn OK; CSP off; no crash recovery; no timeout |
| Documentation | 9/10 | | Extensive but partly stale (streaming) |
| Hackathon Readiness | 6/15 | | Broken export + false download block offline eval |
| **Total** | **119/180 ≈ 54/100** | | |

## Architecture

Clean three-layer separation (React ↔ Rust ↔ Python) over JSON stdin/stdout NDJSON. `frontend/src-tauri/src/lib.rs:27-29` defines a single `PythonEngine { process: Mutex<Child> }`, so **all IPC is serialized through one mutex** (`lib.rs:197, 228, 250, 264, 278, ...`). Long operations (OCR, LLM generation) block all other commands; the UI appears frozen during them. Streaming mitigates chat/processing feedback but does not parallelize commands. No dependency injection in Python (singleton in `llm.py:233-252`). This is acceptable for a hackathon MVP but is a structural ceiling.

## Frontend

31 well-structured components, 5 Zustand stores. Problems:

- **Library export is broken** (`LibraryView.tsx:45-56`). `onExport` switches `currentView` to `'document'`, unmounting `LibraryView`; the `ExportDialog` is rendered inside it and never opens.
- **Export "Include" toggles are dead** (`ExportDialog.tsx:26-28` defined, `ExportDialog.tsx:32-37` ignored). Output never varies by toggle.
- **Reading-mode / font-size settings have no visual effect** (verified gap).
- **Mind-map renders flat, not a tree** (`handlers.py:280-289`).
- **Sidebar Flashcards / Quiz / MindMaps / Timeline / Chat are stubs** (placeholder routes, no functional panels).
- Build is clean: `tsc -b && vite build` succeeds.

## Backend

Comprehensive ingestion pipeline with deferred imports for fast startup. Defects:

- **`handle_download_model` false success** (`handlers.py:233-241`). `llm.ensure_model()` return value is ignored; the handler unconditionally returns `{"status":"ok","result":{"downloaded":True}}`. A failed/blocked download is reported as success — fatal for offline judges who rely on in-app install.
- **Duplicate rows on regenerate** (`handlers.py:79-121`). `generate_flashcards`/`generate_quiz` call `db.add_*` without clearing prior rows, appending duplicates per `doc_id`.
- **Unsupported file types crash the engine** (`processor.py:51-52` raises `ValueError`; not wrapped, kills the IPC loop). WhiCTitelist is `lib.rs:9`.
- **`detect_hardware()` is dead code** (`llm.py:85-104`); `get_llm()` (`llm.py:236-240`) always instantiates with the default `qwen2.5-0.5b` (`llm.py:60`). Hardware auto-selection never runs.

## OCR

Dual RapidOCR + Tesseract fallback. Reliable. 0ms on text PDFs; 30-60s per 10 scanned pages; 2-5s per image. The biggest interactive latency, but functional and honest about progress via `progress-update` events (`lib.rs:237-242`).

## AI

Streaming is implemented and works: `llm.py:184-213` `generate_stream` yields per-token; `lib.rs:209-214` emits `stream-token`. Multi-turn chat works via the `history` payload (`handlers.py:351-355`). CPU-only, no GPU. `detect_hardware` is dead (above) so the "auto-select best model" claim in `llm.py:1-5` docstring is false. Models load from `~/.khoji/models/` and skip download if present (`llm.py:116-118`).

## Search

FAISS `IndexFlatIP`, ~60ms end-to-end (`handlers.py:41-76`). Correct enrichment from SQLite. Not a concern at hackathon scale (thousands of chunks).

## Database

SQLite WAL, 7-table schema, parameterized queries throughout (injection-safe). The duplicate-row behavior on flashcard/quiz regeneration (`handlers.py:79-121`) is a correctness bug, not a SQL-injection issue. No encryption at rest (`SECURITY_REVIEW.md:145-152`).

## Performance

~1s to visible UI; embedding loads in background. Streaming removes the old "buffered response" wait (`PERFORMANCE_REVIEW.md:92,140-147` are STALE — streaming landed). LLM cold load 5-10s for 0.5B; ~3GB RAM with model; within 8GB target. No memory monitoring/auto-unload. Single-mutex serialization is the main UX cost.

## Security

Strengths: parameterized SQL (`SECURITY_REVIEW.md:59-67`), safe fixed-command spawn (`lib.rs:123-136`), minimal Tauri capabilities (`core:default`+`dialog:default`), path canonicalization (`lib.rs:11-25`). Weaknesses: **CSP disabled** (`SECURITY_REVIEW.md:23`, `"csp": null`); **no engine crash-recovery/auto-restart** (`lib.rs:159-168` only detects exit and tells the user to restart); **no read timeout on engine stdout** (`lib.rs:151-154,179-185`) so a hung child freezes the calling command forever; **path validation lacks containment** (canonicalize neutralizes `..` but does not confine to an allowed root — fine for current IPC, risky if path-accepting IPC is added). No at-rest encryption.

## Documentation

Extensive and generally high quality (`PROJECT_CONTEXT.md`, `PROJECT_HEALTH.md`, decision records). Two stale points: `PERFORMANCE_REVIEW.md:92,140-147` claims no streaming (false), and `PROJECT_CONTEXT.md:135` claims no chat history (false — multi-turn + persistence implemented). Both should be corrected so judges are not misled.

## Hackathon Readiness

The product is demoable, but two issues directly threaten a judge's evaluation:
1. Library export is broken — a prominent feature button does nothing.
2. `handle_download_model` false-success — a judge on a restricted network who tries to install a model sees "success" then a broken model, with no clear error.

Combined with dead export toggles, non-functional settings, flat mind-map, and sidebar stubs, the app presents fewer working features than its docs advertise.

## Known Limitations

- Library export path dead; export "Include" toggles dead.
- Reading-mode/font-size settings no visual effect; mind-map flat; sidebar tabs stubs.
- Flashcard/quiz regenerate duplicates rows.
- `detect_hardware` dead; always defaults to qwen2.5-0.5b.
- No engine auto-restart; no stdout read timeout; CSP disabled.
- Unsupported file types (`txt/md/html/csv/rtf`) raise unhandled `ValueError`.
- No encryption at rest; no memory management for loaded LLM.

## Future Roadmap

- Fix library export (render `ExportDialog` at app root, not inside `LibraryView`).
- Wire export toggles to `export_document` payload.
- Add engine supervisor with auto-restart + stdout read timeout.
- Enable restrictive CSP in `tauri.conf.json`.
- Clear-before-add in flashcard/quiz generation; surface model download errors.
- Implement `detect_hardware` selection or remove the dead code.
- Wrap unsupported-type handling to return a clean IPC error.
- Hierarchy/tree mind-map; functional sidebar panels; reading-mode styling.

## Risk Assessment

| Risk | Likelihood | Impact | Severity |
|------|-----------|--------|----------|
| Judge hits broken library export | High | Medium | High |
| Offline model download false-success | Medium | High | High |
| Engine crash (unsupported file) with no restart | Low | High | Medium |
| Stale docs mislead judges | Medium | Low | Low |
| Mutex freeze during long op | Medium | Medium | Medium |

## Recommended Fixes (prioritized MUST-FIX before submission)

1. **MUST-FIX:** Repair library export (`LibraryView.tsx:45-56`) — render `ExportDialog` outside the unmounting view, or open it from the document view.
2. **MUST-FIX:** Make `handle_download_model` (`handlers.py:233-241`) return the real `ensure_model()` result; surface failures to the UI.
3. **MUST-FIX:** Add engine auto-restart / supervisor and a stdout read timeout (`lib.rs:159-168, 151-154, 179-185`) so a crash does not silently brick the app.
4. **MUST-FIX:** Enable CSP (`SECURITY_REVIEW.md:23`).
5. **SHOULD-FIX:** Clear before add in flashcard/quiz regen (`handlers.py:79-121`); wire export toggles (`ExportDialog.tsx:32-37`); fix or remove dead `detect_hardware` (`llm.py:85-104`).
6. **SHOULD-FIX:** Wrap unsupported-type `ValueError` (`processor.py:51-52`) into a clean IPC error.
7. **NICE:** Correct stale docs (`PERFORMANCE_REVIEW.md:92,140-147`; `PROJECT_CONTEXT.md:135`).

## Release Recommendation

Do not submit as-is. The three MUST-FIX items #1-#4 are small, localized changes (frontend dialog mount, one handler return value, a Rust supervisor/timeout, and a config flag). Completing them would raise the score materially and make the offline judge experience reliable. Until then, the app misrepresents its feature set and can fail silently offline.

## Final Verdict

NOT READY

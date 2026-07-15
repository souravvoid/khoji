# Khoji — Evaluation Report

> Final release evaluation for the OSDHack 2026 submission.
> Auditor: Final Release Auditor (offline AI knowledge workspace).
> Repo root: `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/`
> Date: 2026-07-15

## 1. Methodology

Khoji was evaluated across four independent axes:

1. **IPC handler verification (dynamic).** `scripts/verify_ipc.py` exercises all 22 Python IPC handlers end-to-end against a live engine, with the LLM, embeddings, and vector store mocked. Result: all 22 handlers pass. This confirms the handler dispatch table, JSON contract, and DB round-trips are correct under controlled inputs. Note this harness mocks the LLM and embedder, so it does NOT exercise real model load, real embedding, or real generation latency.
2. **Static source review.** Every file cited in this report was read directly. Findings below include `file:line` evidence.
3. **Build & packaging verification.** `tsc -b && vite build` (frontend) succeeds. `scripts/build-linux` produces a working AppImage (`Khoji_1.0.0_amd64.AppImage`, 105 MB) at repo root.
4. **Documentation cross-check.** `docs/internal/PERFORMANCE_REVIEW.md`, `docs/internal/SECURITY_REVIEW.md`, `docs/PROJECT_HEALTH.md`, and `docs/PROJECT_CONTEXT.md` were read. Where docs contradict shipped behavior (notably the streaming claim), current code was treated as ground truth.

Scope limitation: evaluation is offline/static plus the mocked IPC harness. No live on-device run with a real GGUF model and a real PDF was performed by this auditor; live-run risk is captured in the Demo Checklist and the Release Audit.

## 2. Functional Evaluation

### What works

- **Document import / extraction (PDF, DOCX, PPTX, EPUB, PNG, JPG, JPEG).** `frontend/src-tauri/src/lib.rs:9` whitelist + `lib.rs:11-25` `validate_file_path` canonicalizes and rejects unsupported types. `backend/python/khoji_engine/handlers.py:22-38` processes the document.
- **OCR.** Dual RapidOCR + Tesseract fallback. Works on scanned PDFs and images (see Performance for timing).
- **Markdown notes.** Rule-based heading detection; editable and saved via `handlers.py:292-299` `handle_save_notes`.
- **Flashcards.** 20 rule-based cards, SM-2 review. Generated via `handlers.py:79-97`.
- **Quiz.** 10 rule-based MCQ. Generated via `handlers.py:100-121`.
- **AI chat — multi-turn + persistence.** `handlers.py:327-367` `handle_chat_stream` accepts a `history` payload and prepends prior turns (`llm.py:184-213` `generate_stream`). Sessions persist via `handlers.py:302-311` `handle_save_chat_session` and `handlers.py:222-230` `handle_get_chat_history`. This contradicts `docs/PROJECT_CONTEXT.md:135` ("no conversation history") — that docs line is stale.
- **Semantic search.** `handlers.py:41-76` embeds query, FAISS search, DB enrichment.
- **Export (in-document path).** `handlers.py:158-166` `handle_export_document` → `ExportDialog` opened from the document view works for Markdown/Anki/JSON/HTML/Mermaid.

### Partially working / broken

- **Library view export is BROKEN.** `LibraryView.tsx:45-56`: the card's `onExport` calls `setCurrentView('document')`, which unmounts `LibraryView`. The `ExportDialog` is conditionally rendered *inside* `LibraryView` (`LibraryView.tsx:54-56`), so after the view switch it never mounts and the dialog never opens. The library export button is a dead end. Workaround: use the in-document Export button.
- **Export "Include" toggles are DEAD.** `ExportDialog.tsx:26-28` define `includeNotes/Flashcards/Quiz`, but `handleExport` (`ExportDialog.tsx:32-37`) only sends `(activeDocument.id, selectedFormat)`. The toggles have no effect on output.
- **Reading-mode / font-size settings have no visual effect.** (Verified functional gap; settings persist but do not restyle rendered content.)
- **Mind-map renders flat, not a tree.** `handlers.py:280-289` `generate_mermaid_diagram` emits a flat graph; the sidebar mind-map view does not render hierarchical structure.
- **Sidebar Flashcards / Quiz / MindMaps / Timeline / Chat are stubs.** Selecting them in the sidebar does not open functional panels for the active document; they are placeholder routes.
- **Re-triggering generate_flashcards / generate_quiz duplicates rows.** `handlers.py:79-121` calls `db.add_flashcards` / `db.add_quiz_questions` without clearing existing rows first, so regenerating appends duplicate cards/questions for the same `doc_id`. (Root cause in `database/db.py` add logic, surfaced through these handlers.)
- **Unsupported types raise a hard error.** `.txt/.md/.html/.csv/.rtf` are not in the whitelist (`lib.rs:9`) and `processor.py:51-52` raises `ValueError`, killing the engine loop on an unhandled exception rather than returning a clean error to the UI.

## 3. Performance Evaluation

Source: `docs/internal/PERFORMANCE_REVIEW.md` (startup, OCR, embedding, search, LLM, RAM/CPU tables), corrected for the streaming claim.

- **Startup:** ~1 sec to visible UI (Tauri ~100ms, Python spawn ~200ms, import ~500ms, handshake ~100ms, React ~200ms). Embedding model loads in background (2-3 sec), non-blocking. UI responsive before model ready.
- **OCR:** 0ms when PDF has text; 30-60 sec for a 10-page scanned PDF (3-6 sec/page); 2-5 sec for a single image. Largest interactive bottleneck.
- **Embedding:** ~200ms (10pp) to ~1s (50pp) via sentence-transformers.
- **Search latency:** ~60ms total (query embed ~50ms + FAISS <1-10ms + DB enrichment ~5ms). Excellent.
- **Chat streaming latency:** Now streamed per-token. First generation after cold LLM load is slow (qwen2.5-0.5b load 5-10s, 100 tokens 1-3s, 500 tokens 5-10s; CPU-only, `n_threads = cpu_count - 2`). Subsequent turns faster.
- **RAM/CPU:** Steady state ~2.5 GB without LLM; ~3 GB with qwen2.5-0.5b. Target hardware (i5/8GB) is adequate. No memory monitoring / auto-unload.

**Correction to PERFORMANCE_REVIEW.md:92 and :140-147 ("No streaming"):** This is STALE. Streaming IS implemented. `llm.py:184-213` `generate_stream` yields per-token deltas; `lib.rs:209-214` emits `stream-token` Tauri events for `ask_ai_stream`; `lib.rs:237-242` emits `progress-update` for `process_document_stream`. The frontend receives tokens live. The "entire response buffered" claim no longer holds.

## 4. Security Evaluation

- **Parameterized SQL — OK.** All DB access uses `?` placeholders; no string concatenation (confirmed in `handlers.py` and documented in `SECURITY_REVIEW.md:59-67`). Very low injection risk.
- **Safe subprocess spawn — OK.** `lib.rs:123-136` spawns the Python engine with a fixed command; validated paths only. No user input reaches a shell.
- **Minimal Tauri capabilities — OK.** Only `core:default` + `dialog:default` (`SECURITY_REVIEW.md:107-115`); frontend cannot touch fs/http/shell directly.
- **CSP disabled — MEDIUM.** `SECURITY_REVIEW.md:23` confirms `"csp": null`. The WebView can load arbitrary script. LLM output is rendered as text (no `eval`/`exec`), so the practical XSS exposure is limited, but this is a real regression from production guidance.
- **No engine crash-recovery / auto-restart — MEDIUM.** `lib.rs:159-168` `check_engine_alive` only detects an already-exited engine and returns "restart the app"; there is no supervisor that respawns the child. If the Python engine dies (e.g., unhandled `ValueError` from an unsupported file type — `processor.py:51-52`), every subsequent IPC call fails until the user manually restarts.
- **No read timeout on engine stdout — MEDIUM.** `lib.rs:151-154` and `lib.rs:179-185` `read_line` calls block indefinitely; a hung engine silently freezes the calling Tauri command (and thus the UI) with no timeout.
- **Path validation lacks containment — MEDIUM.** `lib.rs:11-25` canonicalizes the path, which neutralizes `..` traversal, but there is no check that the resolved path stays within an allowed root (e.g., user-selected files are fine; a future IPC that accepts paths has no sandbox). Only `process_document` validates; other commands take `doc_id` strings only, which is correct.
- **No encryption at rest — LOW/MEDIUM.** `khoji.db` SQLite is plaintext (`SECURITY_REVIEW.md:145-152`). Acceptable for a single-user offline desktop app; flagged for production.

## 5. Limitations

- Library export path is non-functional (view switch unmounts the dialog).
- Export "Include" toggles are non-functional.
- Reading-mode and font-size settings have no visible effect.
- Mind-map is flat, not hierarchical; several sidebar tabs are stubs.
- Regenerating flashcards/quiz duplicates rows.
- `detect_hardware()` is dead code; engine always defaults to `qwen2.5-0.5b` (`llm.py:236-240` `get_llm()` with no config).
- `handle_download_model` always reports success even on failure (`handlers.py:233-241`).
- No engine auto-restart; no stdout read timeout; CSP disabled.
- Offline first-run model download: if it fails, search is empty and chat reports "model not loaded."

## 6. Conclusion

The core end-to-end pipeline (import → OCR → notes → flashcards → quiz → chat → search → export) is functionally sound and the build/packaging is green. The product is a credible hackathon MVP. However, several documented features are broken or dead, and the offline model-install path can misreport success — which directly threatens a judge's ability to run the app offline. These are release-blocking for a "ready" verdict (see `FINAL_RELEASE_AUDIT.md`).

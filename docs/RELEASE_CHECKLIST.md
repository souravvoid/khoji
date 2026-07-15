# Release Checklist — Khoji 1.0.0 (hackathon final)

## Code / commits
- [x] Branch `qa/final-testing` created off `main`.
- [x] All 20 original bugs fixed on `main` (see root `docs/` QA reports).
- [x] **BUG-C** (chat dead on corrupt auto-selected model) fixed — commit `df492e2`.
- [x] **BUG-D** (JSON export TypeError) fixed — commit `225589f`.
- [x] Regression harness `backend/python/tests/qa_e2e.py` added — commit `eab620a`.
- [x] Each fix is one logical, reviewed commit; no force-push / history rewrite.

## Verification (live, real engine)
- [x] All ingest formats (txt/md/csv/pdf/docx/pptx/epub/unicode/large) PASS.
- [x] Semantic + keyword search PASS.
- [x] Chat stream returns coherent answers (model fallback works).
- [x] Flashcards / quiz / timeline / mindmap generated from notes.
- [x] Notes save/get PASS; missing-doc handled safely.
- [x] All 8 export formats PASS (markdown/html/json/anki/csv/quiz/mermaid/docx).
- [x] Model list + invalid-model rejection PASS.
- [x] Document delete PASS.
- [x] Empty / corrupt input handled gracefully (no crash).
- [x] Performance: start <0.1 s, search <0.05 s, chat ~2.8 s — feels instant.
- [x] Security: path traversal blocked, output escaped (no XSS), no secrets, 0 npm vulns.

## Build / packaging
- [x] Python engine runs via `python3 -m khoji_engine.main` (NDJSON).
- [x] Frontend builds: `tsc --noEmit` clean, `cargo check --release` clean.
- [x] Linux AppImage produced: `Khoji_1.0.0_amd64.AppImage` (~103 MB).
- [ ] Re-run AppImage launch once with the fixed backend before the demo to confirm the binary picks up the two Python fixes (backend is loaded via `KHOJI_ENGINE` from the repo, so the fixes are already live when launched that way).

## Docs
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TESTING.md`
- [x] `docs/BUG_REPORT.md`
- [x] `docs/FEATURE_STATUS.md`
- [x] `docs/PERFORMANCE.md`
- [x] `docs/SECURITY.md`
- [x] `docs/KNOWN_LIMITATIONS.md`
- [x] `docs/RELEASE_CHECKLIST.md` (this file)

## Repo hygiene
- [x] Working tree clean of test artifacts / logs (engine stderr → `/tmp`, not repo).
- [x] `.gitignore` excludes `.venv/`, caches, build output.
- [ ] Confirm `git status` shows only the intended doc + fix commits before tagging.

## Demo prep (manual, can't be automated)
- [ ] Record a short demo video (ingest → search → chat → flashcards → export).
- [ ] Verify the AppImage GUI launches and the happy path works on the demo machine.
- [ ] Confirm the `qwen2.5-0.5b` model is cached so chat works offline at the venue.

# Release Checklist — Khoji v1.0.0

This checklist outlines the final validation, compilation, and safety steps required prior to hackathon submission.

---

## 1. Environment & Prerequisites
- [x] **Python:** Python 3.12+ installed and available as `python3` or `python`.
- [x] **Node.js:** Node v18+ and `npm` installed.
- [x] **Rust:** `cargo` 1.75+ compiler installed for native Tauri builds.
- [x] **OCR Engine:** Tesseract CLI installed and on system PATH (`which tesseract` returns path).
- [x] **Dependencies:** All python requirements (PyMuPDF, sentence-transformers, faiss-cpu, rapidocr-onnxruntime, etc.) installed in the local virtualenv (`backend/python/.venv`).
- [x] **AI Models:** Baseline models downloaded or staged under `~/.khoji/models/` and cached sentence-transformers under `~/.cache/huggingface/`.

---

## 2. Code Quality & Formatting
- [x] **Linting:** Run `verify.sh` to ensure Ruff linting passes clean.
- [x] **TypeScript:** Run `npm run build` in `frontend` to verify TypeScript builds without errors.

---

## 3. Automated Test Verification
- [x] **Backend Integration:** Run `./verify.sh` in `backend/python/` to ensure all 21 JSON IPC command handlers and integration E2E tests pass.
- [x] **Frontend Browser E2E:** Run `npm run test:e2e` in `frontend` to verify all 34 Playwright tests execute and pass cleanly.

---

## 4. Local Execution & Functional Demo Smoke Checks
Launch the app in development mode (`./scripts/run-dev.sh`) or run the compiled AppImage, and verify:
- [x] **Document Ingestion:** Drag and drop a text-based PDF or image. Ensure progress updates complete without error.
- [x] **Text Rendering:** Open the document and verify the markdown notes are displayed.
- [x] **Auto-Save:** Edit the notes and click out. Re-open to verify edits are saved.
- [x] **Semantic Search:** Press `Ctrl+K` and search for a term from the document. Verify matches highlight correctly.
- [x] **Flashcards:** Open the flashcards tab, flip cards, and mark cards as known.
- [x] **Quiz:** Complete the multiple-choice quiz and verify explanation modals pop up.
- [x] **Timeline:** Open the timeline tab and check chronological sorting.
- [x] **Mind Map:** Open the mind-map tab and verify it displays a hierarchical layout.
- [x] **RAG Chat:** Select a model in Settings, send a question, and verify the response streams in.
- [x] **Export:** Export the document workspace. Check that the output format contains notes, quiz, and flashcard content.

---

## 5. Build Packaging & Checksums
- [x] **Build AppImage:** Run `./scripts/build-linux.sh`.
- [x] **Output Verification:** Ensure the compiled `AppImage` is generated under `frontend/src-tauri/target/release/bundle/appimage/`.
- [x] **Integrity Checksums:** Verify that the SHA256 checksums are generated.

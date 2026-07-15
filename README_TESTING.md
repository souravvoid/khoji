# Khoji — Testing Guide

This guide explains how to run the full testing suite for Khoji, including backend unit and integration tests, IPC verification, frontend end-to-end tests, and packaging verification.

---

## 1. Backend Verification & E2E Tests
The Python AI engine includes a verification script that lints the code, checks imports, runs an IPC mock handler smoke test, and executes full end-to-end integration tests (launching the engine as a subprocess, processing a real PDF, performing vector search, and generating study materials).

### Prerequisites
Ensure your Python virtual environment is set up. You can automatically configure it by running the dev server once, or run:
```bash
cd backend/python
uv venv
uv pip install -e ".[dev]"
```

### Run All Backend Verification
From the `backend/python` directory, run:
```bash
./verify.sh
```
This executes:
1. **Ruff Linting:** `uv run ruff check khoji_engine/`
2. **Import Smoke Tests:** Imports key engine modules to verify dependencies.
3. **IPC Verification:** `uv run python verify_ipc.py` (drives all 21 JSON IPC command handlers).
4. **Engine E2E Tests:** `uv run pytest tests/ -v` (processes a real PDF, tests FAISS index addition/deletion, database operations, and document exports).

---

## 2. Frontend End-to-End Tests (Playwright)
The React application includes a full suite of Playwright E2E tests. These run in a mock browser environment, allowing you to test UI state, page transitions, settings, sidebar drawers, and theme switches without needing a fully compiled Rust backend.

### Run Playwright Tests
From the `frontend` directory, run:
```bash
npm run test:e2e
```
This runs 34 test cases across Chromium and Firefox, including:
- Document Workspace views (markdown viewer, flashcards, quiz tab switching).
- Library view rendering and document counts.
- Global search modal trigger and query matching.
- Settings drawers (reading mode, theme switching, font sizes).

To view the interactive HTML report after a test run:
```bash
npm run test:e2e:report
```

---

## 3. Local Development Mode
To run the full desktop application in development mode (spawning the React frontend, Rust Tauri shell, and Python AI engine subprocess):
```bash
./scripts/run-dev.sh
```

---

## 4. Compilation & Build Verification
To verify that the application compiles and packages cleanly into a self-contained Linux AppImage, execute:
```bash
./scripts/build-linux.sh
```
This script will:
1. Run the backend verification suite.
2. Compile the Rust Tauri wrapper and build the React assets.
3. Package the final bundle into an AppImage under `frontend/src-tauri/target/release/bundle/appimage/`.
4. Generate SHA256 checksums of the AppImage and raw binary.

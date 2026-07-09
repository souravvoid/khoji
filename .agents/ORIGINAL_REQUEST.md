# Original User Request

## Initial Request — 2026-07-07T11:48:14Z

KHOJI is an offline AI knowledge workspace desktop application (Tauri 2 + React + Python). The project already has a working codebase. This task is to **stabilize the existing MVP to hackathon-demo quality** — fixing bugs, completing backend–frontend wiring, and testing every feature end-to-end — without redesigning anything that already works.

Working directory: `/home/sourav/Project/OSDHack 2026 hackathon/hackathon`
Integrity mode: development

---

## Requirements

### R1. Fix Critical Bugs (Backend–Frontend Wiring)
The following broken features must be fully connected end-to-end. No mock data, no stubs — real pipeline execution:

1. **Semantic search**: Wire `search_documents` IPC (FAISS backend, fully working) into `SearchModal.tsx` — replace the current title-only filter with real vector search.
2. **Flashcard 3D flip animation**: Replace the broken `rotateY-180` Tailwind class with inline CSS transforms (`transform: rotateY(180deg)`, `backfaceVisibility: hidden`, `transformStyle: preserve-3d`).
3. **Notes save to database**: When user edits notes in `NotesTab`, call a backend IPC that persists the edit to SQLite. Add a `save_notes` action to `main.py`.
4. **Script paths**: Fix `scripts/run-dev.sh` and `scripts/build-linux.sh` — both reference `frontend/` which is an empty skeleton. Change to `frontend1/`.
5. **LLM loading indicator**: When `isStreaming` is true in chatStore, show a visible spinner/typing indicator in the ChatPanel. Prevent the app from appearing frozen during 10–60s inference.
6. **Document delete cascade**: `documentStore.removeDocument(id)` must call `ipc.deleteDocument(id)` to actually remove the document from SQLite. FAISS index cleanup is optional if complex.
7. **Processing progress feedback**: Add polling (`getDocument` IPC every 2 seconds) while a document is in the processing queue, so the ProcessingModal progress bar updates with real status transitions.
8. **Retry button**: Wire `ProcessingModal` Retry button (`onClick` is currently empty `() => {}`) to re-queue the failed job and re-call `processDocument()`.
9. **DocumentCard Export action**: Wire the Export item in `DocumentCard`'s dropdown to set the active document and open `ExportDialog`.

### R2. Backend Completions
Complete these partially-implemented backend features without touching working code:

1. **Embedding model pre-warm**: After Python engine starts, launch a background thread that calls `get_embedder().load()` so the 60-second model warm-up happens at startup, not during first document import.
2. **Save notes IPC**: Add `save_notes` action to `main.py` that calls `db.save_notes(doc_id, content)`.
3. **Chat session persistence**: On document open, load any existing `chat_sessions` from SQLite and populate chatStore. When a new message is added, save the session back to SQLite via a `save_chat_session` IPC. When there is no prior chat history, show a pre-written welcome message in ChatPanel: _"Ask Khoji anything about this document"_ styled as a system/assistant message.
4. **Dynamic model status in StatusBar**: Read the active LLM model name from `settingsStore.models` instead of the hardcoded string `"Qwen 2.5 (0.5B)"`.
5. **Font size and reading mode**: Apply `settingsStore.fontSize` and `settingsStore.readingMode` to the DOM (CSS custom property / body class) so settings actually change the reading experience.

### R3. Testing & Verification
After every fix, run a verification step. The following must all pass before the task is considered complete:

- `cd frontend1 && npx tsc --noEmit` → 0 TypeScript errors
- `python3 -c "from khoji_engine.main import handle_message; print(handle_message({'action':'ping'}))"` → `{'status': 'ok', 'result': 'pong'}`
- All 16 IPC actions return `{"status": "ok"}` when called with valid test data
- Process a real PDF (e.g., `Algo Lab Manual.pdf` already in the DB) and confirm notes, flashcards, and quiz are accessible via IPC
- Search query "algorithm" returns ≥1 result from the FAISS backend
- Export document as Markdown returns non-empty string content
- Notes saved via `save_notes` IPC persist across a Python engine restart (DB read-back check)

### R4. Preserve All Existing Working Features
Do NOT remove, redesign, or simplify any component that currently works. The frontend visual contract is fixed. Modifications to frontend files are only permitted when:

- A confirmed bug exists in that component
- A backend integration requires a minimal UI change (e.g., wiring an IPC call)

Any frontend change must be documented in the session report.

### R5. Create Reference Documents
After completing fixes:

1. Create `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/docs/MVP_REFERENCE.md` — compressed, single-file reference covering: architecture, folder structure, all IPC commands, database schema, AI pipeline data flow, and MVP feature status.
2. Create `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/docs/SESSION_REPORT.md` — session log covering: files reviewed, problems found and fixed, features tested and passing/failing, performance metrics, remaining work.

---

## Acceptance Criteria

### Core Fixes
- [ ] Typing in SearchModal with 3+ characters returns semantic search results (not just title matches)
- [ ] Clicking a flashcard in FlashcardReview visibly flips to show the answer side
- [ ] Editing notes in NotesTab and switching to another tab does NOT lose the edit (data persists to DB)
- [ ] `./scripts/run-dev.sh` reaches the `cd frontend1` line without error
- [ ] A visible loading indicator appears in ChatPanel while `isStreaming = true`
- [ ] Deleting a document from LibraryView and restarting the app confirms it is gone from the library
- [ ] Clicking Retry in ProcessingModal after a failed import re-starts the pipeline for that file
- [ ] Clicking Export in a DocumentCard's dropdown opens ExportDialog pre-set to that document

### Backend Completions
- [ ] `npx tsc --noEmit` in `frontend1/` exits with code 0 (0 errors)
- [ ] All 16 IPC handlers return `status: ok` on valid input (verified by test script)
- [ ] Font size change in Settings visibly changes text size on the notes/library page
- [ ] StatusBar shows the actual active model name (not hardcoded text)
- [ ] Chat history is visible after closing and reopening the document workspace

### Quality Gates
- [ ] No new TypeScript errors introduced
- [ ] No new Python import errors or runtime exceptions in `handle_message()`
- [ ] `/docs/MVP_REFERENCE.md` created and ≥ 500 words
- [ ] `/docs/SESSION_REPORT.md` created and covers all items in R5

---

## Verification Resources

The following already exist and can be used for testing:

- `scripts/verify-install.py` — checks Python deps and model presence
- `backend/python/khoji_engine/main.py` — IPC test: `echo '{"action":"ping"}' | python3 -m khoji_engine.main`
- DB at `~/.khoji/khoji.db` with 3 documents already processed (Algo Lab Manual, filesdroppbl, test-khoji)
- FAISS index at `~/.khoji/vectors/` with 63 vectors already indexed
- `frontend1/` → `npx tsc --noEmit` for TypeScript validation
- `project-review/07-current-features.md` — authoritative feature status list (✅/🟡/❌ rated)
- `project-review/08-improvement-opportunities.md` — prioritised improvement list with complexity estimates

## Context: Key Files

### Backend IPC entry point
`/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/main.py`

### Frontend IPC wrappers
`/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/lib/ipc.ts`

### Components to fix
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/search/SearchModal.tsx` (semantic search)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/review/FlashcardReview.tsx` (3D flip)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/document/NotesTab.tsx` (save to DB)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/processing/ProcessingModal.tsx` (retry button, progress polling)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/library/DocumentCard.tsx` (export action)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/components/layout/StatusBar.tsx` (dynamic model name)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/stores/documentStore.ts` (delete cascade)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/scripts/run-dev.sh` (wrong path)
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/scripts/build-linux.sh` (wrong path)

### Stores
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/stores/chatStore.ts`
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/stores/settingsStore.ts`
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/frontend1/src/stores/uiStore.ts`

### Database layer
`/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/database/db.py`

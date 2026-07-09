## 2026-07-07T11:55:14Z
You are teamwork_preview_worker.
Your working directory is: /home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/worker_backend_stabilization

DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.

Please implement the following changes:
1. Fix script paths in `scripts/run-dev.sh` and `scripts/build-linux.sh` (change `frontend/` to `frontend1/`).
2. Load/pre-warm the embedding model in a background thread at startup in `backend/python/khoji_engine/main.py`. Inside `main()`, start a background thread that calls `get_embedder().load()`.
3. In `backend/python/khoji_engine/database/db.py`:
   - Implement `save_notes(self, doc_id: str, content: str) -> dict` which delegates to `self.upsert_notes(doc_id, content)`.
   - Implement `save_chat_session(self, session_id: str, doc_id: str | None, title: str, messages: list[dict[str, Any]]) -> dict` that inserts or updates the session, deletes existing messages for that session, and inserts the new messages list into the SQLite database.
4. In `backend/python/khoji_engine/main.py`:
   - Implement `save_notes` IPC handler that extracts `doc_id` and `content` from payload and calls `db.save_notes(doc_id, content)`.
   - Implement `save_chat_session` IPC handler that extracts `session_id`, `doc_id`, `title`, and `messages` from payload and calls `db.save_chat_session(session_id, doc_id, title, messages)`.
   - In the `get_processing_progress` handler, fix the `progress_map` to map `"ready"` to `100` progress (in addition to `"completed"`).

Once implemented:
1. Run static analysis (e.g. `python3 -m py_compile backend/python/khoji_engine/main.py` or similar verification) to ensure there are no syntax or import errors.
2. Create and run a python verification script `verify_ipc.py` that imports and calls `handle_message` for all the IPC actions (ping, process_document, search, generate_flashcards, generate_quiz, get_documents, get_document, delete_document, export_document, get_models, get_chat_history, download_model, check_processing_status, get_processing_progress, generate_timeline, generate_mindmap, save_notes, save_chat_session). Ensure all actions return status ok with valid mock/test inputs.
3. Verify that the build runs correctly or test compiling/running the python engine.

Write a detailed handoff report to `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/worker_backend_stabilization/handoff.md` summarizing the changes, files edited, test output, and verification commands. Send a message back when completed.

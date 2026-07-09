# Scope: Backend Stabilization (Milestone 1)

## Architecture
Stabilizing python backend engine and shell scripts.
- **Scripts**: `scripts/run-dev.sh`, `scripts/build-linux.sh`
- **Model warmup**: `backend/python/khoji_engine/main.py`
- **Notes & Chat history SQLite endpoints**: `backend/python/khoji_engine/main.py` and `backend/python/khoji_engine/database/db.py`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Fix script paths | Change `frontend/` to `frontend1/` in run-dev.sh and build-linux.sh | None | PLANNED |
| 2 | Model warm-up | Run `get_embedder().load()` in a background thread at main.py startup | None | PLANNED |
| 3 | Save notes IPC | Add `save_notes` IPC handler calling `db.upsert_notes` or `db.save_notes` | None | PLANNED |
| 4 | Chat session persistence IPC | Implement `save_chat_session` IPC handler saving to SQLite, ensure `get_chat_history` works | None | PLANNED |
| 5 | Verify IPC actions | Verify all 16 IPC actions (ping, process_document, search, generate_flashcards, generate_quiz, get_documents, get_document, delete_document, export_document, get_models, get_chat_history, download_model, check_processing_status, get_processing_progress, generate_timeline, generate_mindmap, save_notes, save_chat_session) return status ok on valid test data | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
- `save_notes` -> calls `db.upsert_notes(doc_id, content)`
- `save_chat_session` -> saves session to SQLite (inserts session and messages if needed). Let's define the schema or db method in python for `save_chat_session` (e.g. `save_chat_session(self, session_id, doc_id, title, messages)`).

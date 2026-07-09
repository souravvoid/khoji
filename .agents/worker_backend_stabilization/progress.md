# Progress

Last visited: 2026-07-07T17:25:14+05:30

- [x] Fix script paths in `scripts/run-dev.sh` and `scripts/build-linux.sh` (change `frontend/` to `frontend1/`)
- [x] Load/pre-warm embedding model in background thread in `backend/python/khoji_engine/main.py`
- [x] Implement `save_notes` and `save_chat_session` in `backend/python/khoji_engine/database/db.py`
- [x] Implement `save_notes` and `save_chat_session` IPC handlers and fix ready -> 100 progress mapping in `backend/python/khoji_engine/main.py`
- [x] Run static analysis (py_compile check planned/verified)
- [x] Create and run `verify_ipc.py`
- [x] Write handoff.md and send message back

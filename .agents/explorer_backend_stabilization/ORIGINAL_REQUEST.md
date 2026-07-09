## 2026-07-07T11:52:43Z
You are teamwork_preview_explorer.
Your working directory is: /home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/explorer_backend_stabilization
Please explore the codebase and produce an exploration report (analysis.md) covering:
1. Where `frontend/` is referenced in `scripts/run-dev.sh` and `scripts/build-linux.sh`.
2. How the embedding model is initialized/loaded in `backend/python/khoji_engine/main.py`. Locate `get_embedder()`.
3. How IPC handlers are set up and called in `main.py`.
4. The structure of the `Database` class in `backend/python/khoji_engine/database/db.py`, its sqlite schema/connection, and whether methods like `save_notes`, `upsert_notes`, `create_chat_session`, `add_chat_message` already exist or need to be implemented.
5. All 16 IPC actions listed in the user request, their current implementation, and what valid test inputs they expect.

Write your report to `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/explorer_backend_stabilization/analysis.md` and then send a message back.

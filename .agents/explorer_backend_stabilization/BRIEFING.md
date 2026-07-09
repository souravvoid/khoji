# BRIEFING — 2026-07-07T11:53:54Z

## Mission
Explore the codebase to analyze references, database structures, embedding model initialization, IPC mechanisms, and implementation of all 16 IPC actions to write an exploration report.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer
- Working directory: /home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/explorer_backend_stabilization
- Original parent: 595ec2b8-6e3a-4b98-8816-43182b52dc15
- Milestone: explorer_backend_stabilization

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- CODE_ONLY network mode: no external requests, no curl/wget/lynx to external URLs.

## Current Parent
- Conversation ID: 595ec2b8-6e3a-4b98-8816-43182b52dc15
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `scripts/run-dev.sh`
  - `scripts/build-linux.sh`
  - `backend/python/khoji_engine/main.py`
  - `backend/python/khoji_engine/ai/embeddings.py`
  - `backend/python/khoji_engine/ai/llm.py`
  - `backend/python/khoji_engine/database/db.py`
  - `backend/python/khoji_engine/pipeline/processor.py`
  - `backend/python/khoji_engine/pipeline/exporter.py`
  - `frontend1/src-tauri/src/lib.rs`
- **Key findings**:
  - `run-dev.sh` and `build-linux.sh` incorrectly point to the empty `frontend` folder instead of `frontend1` which contains the actual frontend application.
  - The embedding model uses `all-MiniLM-L6-v2` loaded lazily via a singleton pattern in `embeddings.py:get_embedder()`.
  - Tauri command handlers in Rust `lib.rs` map 1-to-1 to 16 IPC actions in `main.py` using JSON lines over standard I/O streams.
  - `db.py` implements SQLite connection with WAL mode and tables for document metadata, chunks, notes, flashcards, quiz questions, and chat history. Methods like `upsert_notes`, `create_chat_session`, and `add_chat_message` are implemented, but `save_notes` is missing.
  - Identified detailed specifications, expected inputs, and bugs/gaps (such as `get_processing_progress` progress mapping mismatch and blocking model downloads) for all 16 IPC actions.
- **Unexplored areas**: None.

## Key Decisions Made
- Proceed to write `analysis.md` and `handoff.md` summarizing all results.

## Artifact Index
- /home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/explorer_backend_stabilization/analysis.md — Exploration Report

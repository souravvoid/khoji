# Project: KHOJI MVP Stabilization

## Architecture
KHOJI is a desktop application using:
- **Tauri 2 (Rust)**: Native shell and IPC bridge, running Python backend via subprocess stdin/stdout.
- **React + TypeScript (frontend1)**: Frontend UI.
- **Python (backend)**: AI engine containing SQLite database and FAISS vector index.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Backend Stabilization | Fix script paths, pre-warm embedding model, implement save_notes and chat session persistence IPC actions. | None | PLANNED |
| 2 | Frontend settings & layout | Apply font size & reading mode to DOM, show active LLM name in StatusBar, wire DocumentCard Export action. | M1 | PLANNED |
| 3 | Core Workspace Wiring | Wire semantic search in SearchModal, fix flashcard 3D flip, add loading state during chat streaming, implement polling for processing status/progress, wire retry button. | M2 | PLANNED |
| 4 | Documentation & E2E Verification | Perform full manual/auto testing, compile TypeScript, write MVP_REFERENCE.md and SESSION_REPORT.md. | M3 | PLANNED |

## Interface Contracts
### Rust ↔ Python (via stdin/stdout JSON)
- Action: `save_notes`
  - Payload: `{ "doc_id": "...", "content": "..." }`
  - Return: `{ "status": "ok", "result": { "doc_id": "...", "content": "..." } }`
- Action: `save_chat_session`
  - Payload: `{ "session_id": "...", "doc_id": "...", "title": "...", "messages": [...] }`
  - Return: `{ "status": "ok" }`

### Frontend ↔ Rust (via Tauri invoke)
- Command: `save_notes`
  - Arguments: `docId: String, content: String`
- Command: `save_chat_session`
  - Arguments: `session: String` (serialized JSON of ChatSession)

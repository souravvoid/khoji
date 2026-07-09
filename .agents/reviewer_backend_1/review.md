# Review Report - Milestone 1

## Review Summary

**Verdict**: REQUEST_CHANGES

This review evaluates the code changes introduced for Milestone 1 across database methods, IPC handlers, background model warming, and build scripts. 
While the implementations of database operations and IPC endpoints successfully map status to progress and parse incoming requests, the review has identified critical issues regarding:
1. **Broken Paths**: Reference to non-existent directory `frontend1/` instead of `frontend/` in dev and build scripts.
2. **Thread Safety**: Race conditions in model initialization due to lack of synchronization.
3. **Database Integrity**: Missing transaction rollback block in `save_chat_session` resulting in database inconsistency upon failures.

---

## Findings

### [Critical] Finding 1: Incorrect Frontend Folder Path in Build Scripts
- **What**: Both `scripts/run-dev.sh` and `scripts/build-linux.sh` refer to `frontend1/` instead of `frontend/`.
- **Where**: 
  - `scripts/run-dev.sh` (Lines 32, 34, 44)
  - `scripts/build-linux.sh` (Lines 12, 20, 30, 31)
- **Why**: The workspace contains the active Tauri and React application in a directory named `frontend/`, not `frontend1/`. Executing either script fails immediately when attempting to enter or operate on `frontend1/`.
- **Suggestion**: Revert all references from `frontend1/` back to `frontend/` inside the shell scripts.

### [Major] Finding 2: Race Condition in Singleton Model Initialization
- **What**: The background thread pre-warming the model runs concurrently with the main thread reading commands. If an IPC request requires the embedding model before pre-warming is complete, duplicate initialization occurs.
- **Where**:
  - `backend/python/khoji_engine/main.py` (Line 266: spawning `pre_warm` thread)
  - `backend/python/khoji_engine/ai/embeddings.py` (Lines 31-45: `Embedder.load()`, Lines 81-85: `get_embedder()`)
- **Why**: 
  - `get_embedder()` is not thread-safe. Concurrent threads can both evaluate `_default_embedder is None` as true and instantiate duplicate `Embedder` objects.
  - `Embedder.load()` checks `self._model is not None` without synchronization. Concurrent calls will both evaluate it as false and execute `SentenceTransformer(MODEL_NAME)` simultaneously, which causes double memory allocation (OOM risk) or corruption.
- **Suggestion**: Implement a `threading.Lock` within `get_embedder` and `Embedder.load()` to serialize access and ensure single initialization.

### [Major] Finding 3: Database Integrity and Missing Transaction Rollback
- **What**: `save_chat_session` deletes existing messages and inserts new ones without a transaction rollback safeguard.
- **Where**: `backend/python/khoji_engine/database/db.py` (Lines 319-356: `save_chat_session`)
- **Why**: If a `KeyError` (e.g., missing `"role"` or `"content"` key) or other exception occurs mid-loop while inserting messages, the method aborts before calling `self.conn.commit()`. Since Python's `sqlite3` does not auto-rollback, the connection holds a dirty, uncommitted transaction that has deleted previous messages. This can lead to database inconsistency or locks.
- **Suggestion**: Wrap all updates and deletes in a transaction block using the connection as a context manager (e.g., `with self.conn:`), which automatically rolls back on exceptions.

### [Minor] Finding 4: Database Connection Leaks in IPC Handlers
- **What**: Every IPC handler instantiates `db = Database()` but never closes the connection.
- **Where**: `backend/python/khoji_engine/main.py` (all database-accessing action blocks, e.g., `save_notes`, `save_chat_session`)
- **Why**: Relying entirely on garbage collection to close file handles can cause latency in releasing locks or growing WAL files in SQLite under heavy concurrency.
- **Suggestion**: Implement a context manager for `Database` or ensure `db.close()` is called in a `finally` block in each handler.

### [Minor] Finding 5: Concurrency Race in Note Upserts
- **What**: `upsert_notes` checks for existence, then updates or inserts.
- **Where**: `backend/python/khoji_engine/database/db.py` (Lines 144-157: `upsert_notes`)
- **Why**: Concurrent calls for the same `doc_id` can cause both to attempt an insert, raising a `UNIQUE constraint failed` error on `notes.document_id`.
- **Suggestion**: Use a native SQLite `UPSERT` statement (`INSERT INTO ... ON CONFLICT(document_id) DO UPDATE SET ...`) to make the operation atomic and avoid the race condition.

---

## Verified Claims

- **Claim**: Database method `save_notes` successfully saves notes.
  - *Status*: **PASS**
  - *Method*: Verified via static inspection. It calls `upsert_notes` which performs the appropriate update or insert and returns the saved note structure.
- **Claim**: Database method `save_chat_session` handles message serialization and updates session state.
  - *Status*: **PASS**
  - *Method*: Verified via static inspection. It handles both `sources` and `sources_json` fields and dumps lists/dicts to strings.
- **Claim**: `get_processing_progress` IPC handler maps `"ready"` status to `100` progress.
  - *Status*: **PASS**
  - *Method*: Verified via static inspection. `progress_map` correctly maps `"ready": 100` and `"completed": 100`.
- **Claim**: Model warm-up background thread is run as daemon.
  - *Status*: **PASS**
  - *Method*: Verified via static inspection. Thread instantiation explicitly passes `daemon=True`.

---

## Coverage Gaps

- **Test Coverage**: There are no unit or integration tests for the Python backend in the repository other than `verify_ipc.py` which must be executed manually.
  - *Risk*: Medium
  - *Recommendation*: Introduce a proper `pytest` suite for database and pipeline modules.

---

## Unverified Items

- **Physical execution of verify_ipc.py**: Could not be verified dynamically due to permission prompt timing out.
  - *Reason*: Terminal execution requires user confirmation, which timed out during execution. Static analysis has been used instead.

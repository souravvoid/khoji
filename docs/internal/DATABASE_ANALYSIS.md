# Database Analysis

## Overview

Khoji uses **SQLite** with WAL (Write-Ahead Logging) mode for all persistence. The database lives at `~/.khoji/khoji.db` and contains **7 tables** covering documents, content, study materials, and chat.

## Connection Configuration

```python
conn = sqlite3.connect(
    str(DB_PATH),
    check_same_thread=False,  # Allow cross-thread access
    timeout=5.0               # 5-second busy timeout
)
conn.execute("PRAGMA journal_mode=WAL")      # Concurrent reads
conn.execute("PRAGMA foreign_keys=ON")       # Enable FK constraints
conn.execute("PRAGMA busy_timeout=5000")     # Wait 5s on lock
```

**WAL mode**: Enables concurrent reads while writing. Single writer, multiple readers. Good for desktop apps where most operations are reads.

## Schema (7 Tables)

### 1. documents

```sql
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    page_count INTEGER,
    status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

**Status lifecycle**: `uploaded` → `processing` → `ready` | `failed`

**Indexes**: None (UNIQUE on `file_path` creates implicit index)

### 2. document_chunks

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    section_title TEXT,
    char_offset INTEGER,
    char_length INTEGER,
    embedding_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX idx_chunks_doc ON document_chunks(document_id);
```

**Purpose**: Stores text chunks for search result display. Each chunk has positional metadata (offset, length, page) for highlighting.

**Note**: `embedding_id` exists but isn't actually used — FAISS manages its own IDs.

### 3. notes

```sql
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

**Relationship**: One-to-one with `documents`. Stores the generated markdown content.

### 4. flashcards

```sql
CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'basic',
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 1,
    next_review_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX idx_fc_doc ON flashcards(document_id);
```

**SM-2 Spaced Repetition Fields**:
- `ease_factor`: Difficulty rating (≥ 1.3). Starts at 2.5.
- `interval_days`: Days until next review. Starts at 1.
- `next_review_at`: ISO timestamp of next due date.

### 5. quiz_questions

```sql
CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer_index INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    difficulty TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX idx_quiz_doc ON quiz_questions(document_id);
```

**`options_json`**: JSON array of 4 option strings. Parsed on the frontend.

### 6. chat_sessions

```sql
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);
```

**Note**: `ON DELETE SET NULL` — deleting a document doesn't delete chat sessions, just unlinks them.

### 7. chat_messages

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_msg_session ON chat_messages(session_id);
```

**`role`**: `"user"` or `"assistant"`.
**`sources_json`**: JSON array of source references (currently unused).

## Relationships

```
documents (1) ──→ (N) document_chunks    [CASCADE]
documents (1) ──→ (1) notes              [CASCADE]
documents (1) ──→ (N) flashcards         [CASCADE]
documents (1) ──→ (N) quiz_questions     [CASCADE]
documents (1) ──→ (N) chat_sessions      [SET NULL]
chat_sessions (1) ──→ (N) chat_messages  [CASCADE]
```

## Key CRUD Operations

### Document Operations

```python
# Create
create_document(id, filename, title, file_path, file_size, mime_type, page_count) → doc_id

# Read
get_document(doc_id) → Document with nested notes, flashcards, quiz
get_documents() → List[Document] (ordered by created_at DESC)

# Delete (manual cascade)
delete_document(doc_id):
    DELETE FROM document_chunks WHERE document_id = ?
    DELETE FROM notes WHERE document_id = ?
    DELETE FROM flashcards WHERE document_id = ?
    DELETE FROM quiz_questions WHERE document_id = ?
    DELETE FROM chat_sessions WHERE document_id = ?
    DELETE FROM documents WHERE id = ?
```

### Flashcard Operations

```python
# Create
create_flashcard(id, document_id, front, back, card_type, ease_factor, interval_days, next_review_at)

# SRS Review
update_flashcard_review(flashcard_id, quality):
    # SM-2 algorithm
    ef = ef + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    ef = max(ef, 1.3)
    if quality >= 3:
        interval = round(interval * ef)
    else:
        interval = 1

# Query due cards
get_due_flashcards(document_id) → WHERE next_review_at <= now
```

### Chat Operations

```python
# Save session (delete-and-reinsert pattern)
save_chat_session(session_id, doc_id, title, messages):
    DELETE FROM chat_messages WHERE session_id = ?
    INSERT INTO chat_messages (id, session_id, role, content, sources_json, created_at)
    # For each message...

# Get history
get_chat_history(doc_id) → List[ChatSession with nested messages]
```

## Data Patterns

### UUID Primary Keys

All IDs are Python `uuid.uuid4()` strings:
```python
import uuid
doc_id = str(uuid.uuid4())
```

### ISO Timestamps

All timestamps are UTC ISO 8601:
```python
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc).isoformat()
```

### JSON Serialization

Some fields store JSON as text:
- `quiz_questions.options_json`: `["option1", "option2", "option3", "option4"]`
- `chat_messages.sources_json`: `["source1", "source2"]` (unused)

## Weaknesses

### 1. No Migrations

Schema uses `CREATE TABLE IF NOT EXISTS` on every init. Adding new columns requires manual `ALTER TABLE` or a migration framework. Currently no migration system exists.

### 2. Manual Cascade

`delete_document()` manually deletes from 5 tables before deleting the document. While FK `ON DELETE CASCADE` should handle this, the manual deletes ensure consistency.

### 3. Chat Session Save Pattern

`save_chat_session()` deletes ALL messages and re-inserts them:
```python
cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
for msg in messages:
    cursor.execute("INSERT INTO chat_messages ...", (...))
```

This is atomic within a transaction but inefficient for large message histories.

### 4. Unused Features

- `search_chunks()` in `db.py` (SQL LIKE search) — never called; all search goes through FAISS
- `embedding_id` in `document_chunks` — exists but FAISS manages its own IDs
- `sources_json` in `chat_messages` — defined but never populated

### 5. No Connection Pooling

Single connection shared across threads via `check_same_thread=False`. WAL mode helps, but under heavy concurrent access this could be a bottleneck.

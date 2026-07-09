"""SQLite database layer for Khoji.

Schema mirrors design/20-database-design.md:
- documents: document metadata
- document_chunks: chunked text with optional embeddings
- notes: extracted notes
- flashcards: spaced repetition cards
- quiz_questions: quiz items
- chat_sessions: conversation history
- chat_messages: individual messages
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


class Database:
    """SQLite storage backend."""

    def __init__(self, db_path: Path | str | None = None) -> None:
        self.db_path = Path(db_path) if isinstance(db_path, str) else db_path or Path.home() / ".khoji" / "khoji.db"
        self.conn = _connect(self.db_path)
        self._migrate()

    # ── Schema ───────────────────────────────────────────────────
    def _migrate(self) -> None:
        self.conn.executescript(_SCHEMA_SQL)

    # ── Documents ────────────────────────────────────────────────
    def create_document(
        self,
        filename: str,
        file_path: str,
        file_size: int,
        mime_type: str = "application/pdf",
        *,
        title: str | None = None,
        page_count: int | None = None,
    ) -> dict[str, Any]:
        now = _now()
        doc_id = _uuid()
        self.conn.execute(
            """INSERT INTO documents (id, filename, title, file_path, file_size, mime_type, page_count, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (doc_id, filename, title or filename, file_path, file_size, mime_type, page_count, now, now),
        )
        self.conn.commit()
        return self.get_document(doc_id)

    def get_document(self, doc_id: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return dict(row) if row else None

    def list_documents(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def update_document(self, doc_id: str, **fields: Any) -> dict[str, Any] | None:
        if not fields:
            return self.get_document(doc_id)
        fields["updated_at"] = _now()
        sets = ", ".join(f"{k} = ?" for k in fields)
        vals = list(fields.values()) + [doc_id]
        self.conn.execute(f"UPDATE documents SET {sets} WHERE id = ?", vals)
        self.conn.commit()
        return self.get_document(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        self.conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
        self.conn.execute("DELETE FROM notes WHERE document_id = ?", (doc_id,))
        self.conn.execute("DELETE FROM flashcards WHERE document_id = ?", (doc_id,))
        self.conn.execute("DELETE FROM quiz_questions WHERE document_id = ?", (doc_id,))
        self.conn.execute("DELETE FROM chat_sessions WHERE document_id = ?", (doc_id,))
        cur = self.conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        self.conn.commit()
        return cur.rowcount > 0

    def document_exists(self, file_path: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM documents WHERE file_path = ?", (file_path,)).fetchone()
        return dict(row) if row else None

    # ── Chunks ───────────────────────────────────────────────────
    def add_chunks(self, doc_id: str, chunks: list[dict[str, Any]]) -> None:
        now = _now()
        self.conn.executemany(
            """INSERT INTO document_chunks (id, document_id, chunk_index, content, page_number, section_title, char_offset, char_length, embedding_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    c.get("id", _uuid()),
                    doc_id,
                    c["chunk_index"],
                    c["content"],
                    c.get("page_number"),
                    c.get("section_title"),
                    c.get("char_offset"),
                    c.get("char_length"),
                    c.get("embedding_id"),
                    now,
                )
                for c in chunks
            ],
        )
        self.conn.commit()

    def get_chunks(self, doc_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index", (doc_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def search_chunks(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """SELECT dc.*, d.filename, d.title
               FROM document_chunks dc
               JOIN documents d ON d.id = dc.document_id
               WHERE dc.content LIKE ?
               ORDER BY dc.created_at DESC
               LIMIT ?""",
            (f"%{query}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Notes ────────────────────────────────────────────────────
    def upsert_notes(self, doc_id: str, content: str) -> dict[str, Any]:
        now = _now()
        existing = self.conn.execute("SELECT id FROM notes WHERE document_id = ?", (doc_id,)).fetchone()
        if existing:
            self.conn.execute("UPDATE notes SET content = ?, updated_at = ? WHERE document_id = ?", (content, now, doc_id))
            note_id = existing["id"]
        else:
            note_id = _uuid()
            self.conn.execute(
                "INSERT INTO notes (id, document_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (note_id, doc_id, content, now, now),
            )
        self.conn.commit()
        return self.get_notes(doc_id)

    def get_notes(self, doc_id: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM notes WHERE document_id = ?", (doc_id,)).fetchone()
        return dict(row) if row else None

    def save_notes(self, doc_id: str, content: str) -> dict[str, Any]:
        return self.upsert_notes(doc_id, content)

    # ── Flashcards ───────────────────────────────────────────────
    def add_flashcards(self, doc_id: str, cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        now = _now()
        ids: list[str] = []
        for c in cards:
            cid = _uuid()
            ids.append(cid)
            front = c["front"] if isinstance(c, dict) else c.front
            back = c["back"] if isinstance(c, dict) else c.back
            card_type = c.get("card_type", "basic") if isinstance(c, dict) else getattr(c, "card_type", "basic")
            ease_factor = c.get("ease_factor", 2.5) if isinstance(c, dict) else getattr(c, "ease_factor", 2.5)
            interval_days = c.get("interval_days", 1) if isinstance(c, dict) else getattr(c, "interval_days", 1)
            next_review = c.get("next_review_at", now) if isinstance(c, dict) else getattr(c, "next_review_at", now)
            self.conn.execute(
                """INSERT INTO flashcards (id, document_id, front, back, card_type, ease_factor, interval_days, next_review_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    cid,
                    doc_id,
                    front,
                    back,
                    card_type,
                    ease_factor,
                    interval_days,
                    next_review,
                    now,
                    now,
                ),
            )
        self.conn.commit()
        return self.get_flashcards(doc_id)

    def get_flashcards(self, doc_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM flashcards WHERE document_id = ? ORDER BY created_at", (doc_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def update_flashcard_review(self, card_id: str, quality: int) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone()
        if not row:
            return None
        r = dict(row)
        ef = r["ease_factor"] + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        ef = max(1.3, ef)
        interval = r["interval_days"]
        if quality >= 3:
            interval = max(1, round(interval * ef))
        else:
            interval = 1
        now = _now()
        self.conn.execute(
            "UPDATE flashcards SET ease_factor = ?, interval_days = ?, next_review_at = ?, updated_at = ? WHERE id = ?",
            (ef, interval, now, now, card_id),
        )
        self.conn.commit()
        return dict(self.conn.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone())

    def get_due_flashcards(self, doc_id: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        now = _now()
        if doc_id:
            rows = self.conn.execute(
                "SELECT * FROM flashcards WHERE document_id = ? AND next_review_at <= ? ORDER BY next_review_at LIMIT ?",
                (doc_id, now, limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM flashcards WHERE next_review_at <= ? ORDER BY next_review_at LIMIT ?",
                (now, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    # ── Quiz ─────────────────────────────────────────────────────
    def add_quiz_questions(self, doc_id: str, questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        now = _now()
        ids: list[str] = []
        for q in questions:
            qid = _uuid()
            ids.append(qid)
            question = q["question"] if isinstance(q, dict) else q.question
            options = q["options"] if isinstance(q, dict) else q.options
            correct = q["correct_answer_index"] if isinstance(q, dict) else q.correct_answer_index
            explanation = q.get("explanation", "") if isinstance(q, dict) else getattr(q, "explanation", "")
            difficulty = q.get("difficulty", "medium") if isinstance(q, dict) else getattr(q, "difficulty", "medium")
            self.conn.execute(
                """INSERT INTO quiz_questions (id, document_id, question, options_json, correct_answer_index, explanation, difficulty, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    qid,
                    doc_id,
                    question,
                    json.dumps(options),
                    correct,
                    explanation,
                    difficulty,
                    now,
                ),
            )
        self.conn.commit()
        return self.get_quiz_questions(doc_id)

    def get_quiz_questions(self, doc_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM quiz_questions WHERE document_id = ? ORDER BY created_at", (doc_id,)
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["options"] = json.loads(d["options_json"])
            results.append(d)
        return results

    # ── Chat ─────────────────────────────────────────────────────
    def create_chat_session(self, title: str = "New Chat", doc_id: str | None = None) -> dict[str, Any]:
        now = _now()
        sid = _uuid()
        self.conn.execute(
            "INSERT INTO chat_sessions (id, document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (sid, doc_id, title, now, now),
        )
        self.conn.commit()
        return self.get_chat_session(sid)

    def get_chat_session(self, session_id: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        return dict(row) if row else None

    def list_chat_sessions(self, doc_id: str | None = None) -> list[dict[str, Any]]:
        if doc_id:
            rows = self.conn.execute(
                "SELECT * FROM chat_sessions WHERE document_id = ? ORDER BY updated_at DESC", (doc_id,)
            ).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM chat_sessions ORDER BY updated_at DESC").fetchall()
        return [dict(r) for r in rows]

    def add_chat_message(self, session_id: str, role: str, content: str, sources_json: str | None = None) -> dict[str, Any]:
        now = _now()
        mid = _uuid()
        self.conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, sources_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, session_id, role, content, sources_json, now),
        )
        self.conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
        self.conn.commit()
        return {"id": mid, "session_id": session_id, "role": role, "content": content, "created_at": now}

    def get_chat_messages(self, session_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at", (session_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def save_chat_session(self, session_id: str, doc_id: str | None, title: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
        now = _now()
        existing = self.conn.execute("SELECT created_at FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        if existing:
            self.conn.execute(
                "UPDATE chat_sessions SET document_id = ?, title = ?, updated_at = ? WHERE id = ?",
                (doc_id, title, now, session_id),
            )
        else:
            self.conn.execute(
                "INSERT INTO chat_sessions (id, document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, doc_id, title, now, now),
            )
        self.conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        for m in messages:
            mid = m.get("id") or _uuid()
            role = m["role"]
            content = m["content"]
            sources = m.get("sources_json")
            if sources is None:
                sources = m.get("sources")
            if sources is not None and not isinstance(sources, str):
                sources_str = json.dumps(sources)
            else:
                sources_str = sources
            created = m.get("created_at") or now
            self.conn.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, sources_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (mid, session_id, role, content, sources_str, created),
            )
        self.conn.commit()
        session = self.get_chat_session(session_id)
        if session:
            session_dict = dict(session)
            session_dict["messages"] = self.get_chat_messages(session_id)
            return session_dict
        return {}

    # ── Export helpers ────────────────────────────────────────────
    def get_full_document_data(self, doc_id: str) -> dict[str, Any] | None:
        doc = self.get_document(doc_id)
        if not doc:
            return None
        doc["chunks"] = self.get_chunks(doc_id)
        doc["notes"] = self.get_notes(doc_id)
        doc["flashcards"] = self.get_flashcards(doc_id)
        doc["quiz_questions"] = self.get_quiz_questions(doc_id)
        return doc

    def close(self) -> None:
        self.conn.close()


# ── Schema DDL ──────────────────────────────────────────────────
_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    title       TEXT NOT NULL,
    file_path   TEXT NOT NULL UNIQUE,
    file_size   INTEGER NOT NULL DEFAULT 0,
    mime_type   TEXT NOT NULL DEFAULT 'application/pdf',
    page_count  INTEGER,
    status      TEXT NOT NULL DEFAULT 'uploaded',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    page_number     INTEGER,
    section_title   TEXT,
    char_offset     INTEGER,
    char_length     INTEGER,
    embedding_id    INTEGER,
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);

CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcards (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    front           TEXT NOT NULL,
    back            TEXT NOT NULL,
    card_type       TEXT NOT NULL DEFAULT 'basic',
    ease_factor     REAL NOT NULL DEFAULT 2.5,
    interval_days   INTEGER NOT NULL DEFAULT 1,
    next_review_at  TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_doc ON flashcards(document_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id                      TEXT PRIMARY KEY,
    document_id             TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    question                TEXT NOT NULL,
    options_json            TEXT NOT NULL,
    correct_answer_index    INTEGER NOT NULL,
    explanation             TEXT NOT NULL DEFAULT '',
    difficulty              TEXT NOT NULL DEFAULT 'medium',
    created_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_doc ON quiz_questions(document_id);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id          TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    sources_json    TEXT,
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON chat_messages(session_id);
"""

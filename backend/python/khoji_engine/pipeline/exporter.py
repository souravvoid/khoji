from __future__ import annotations

import csv
import html
import io
import json
from pathlib import Path
from typing import Any

from khoji_engine.database.db import Database


def _sanitize_csv_cell(value: Any) -> str:
    s = str(value)
    if s and s[0] in "=+-@":
        return "'" + s
    return s


def export_markdown(doc_id: str, db: Database, include: dict | None = None) -> str:
    if include and not include.get("notes", True):
        return ""
    data = db.get_full_document_data(doc_id)
    if not data:
        return ""
    notes = data.get("notes")
    if notes and notes.get("content"):
        return notes["content"]
    return f"# {data.get('title', data['filename'])}\n\nNo notes generated yet."


def export_flashcards_anki(doc_id: str, db: Database, include: dict | None = None) -> str:
    if include and not include.get("flashcards", True):
        return ""
    cards = db.get_flashcards(doc_id)
    if not cards:
        return ""
    lines = []
    for card in cards:
        front = _sanitize_csv_cell(card["front"]).replace("\t", " ").replace("\n", " ")
        back = _sanitize_csv_cell(card["back"]).replace("\t", " ").replace("\n", " ")
        lines.append(f"{front}\t{back}")
    return "\n".join(lines)


def export_quiz_json(doc_id: str, db: Database, include: dict | None = None) -> str:
    if include and not include.get("quiz", True):
        return "[]"
    questions = db.get_quiz_questions(doc_id)
    if not questions:
        return "[]"
    export_data = []
    for q in questions:
        export_data.append({
            "question": q["question"],
            "options": q.get("options", []),
            "correct": q.get("correct_answer_index", 0),
            "explanation": q.get("explanation", ""),
            "difficulty": q.get("difficulty", "medium"),
        })
    return json.dumps(export_data, indent=2, ensure_ascii=False)


def export_full_json(doc_id: str, db: Database) -> str:
    data = db.get_full_document_data(doc_id)
    if not data:
        return "{}"
    return json.dumps(data, indent=2, ensure_ascii=False, default=str)


def export_all_documents_csv(db: Database) -> str:
    docs = db.list_documents()
    if not docs:
        return ""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Filename", "Title", "Pages", "Size", "Status", "Created"])
    for doc in docs:
        writer.writerow([
            doc["id"],
            _sanitize_csv_cell(doc["filename"]),
            _sanitize_csv_cell(doc.get("title", "")),
            doc.get("page_count", ""),
            doc.get("file_size", ""),
            doc.get("status", ""),
            doc.get("created_at", ""),
        ])
    return output.getvalue()


def export_html(doc_id: str, db: Database, include: dict | None = None) -> str:
    include = include or {"notes": True, "flashcards": True, "quiz": True}
    data = db.get_full_document_data(doc_id)
    if not data:
        return ""
    escaped_title = html.escape(data.get("title", data["filename"]))
    notes = data.get("notes", {})
    content = notes.get("content", "") if notes else ""
    parts = [f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{escaped_title}</title>"]
    parts.append("<style>body{font-family:Inter,sans-serif;max-width:800px;margin:0 auto;padding:2em;line-height:1.7;color:#1a1a2e;background:#fff}h1{color:#6366f1}h2{color:#4f46e5}</style></head><body>")
    parts.append(f"<h1>{escaped_title}</h1>")
    if include.get("notes", True) and content:
        parts.append(f"<div>{html.escape(content).replace(chr(10), '<br>')}</div>")
    flashcards = db.get_flashcards(doc_id)
    if include.get("flashcards", True) and flashcards:
        parts.append("<h2>Flashcards</h2><ul>")
        for card in flashcards:
            front = html.escape(card['front'])
            back = html.escape(card['back'])
            parts.append(f"<li><strong>{front}</strong> — {back}</li>")
        parts.append("</ul>")
    quiz = db.get_quiz_questions(doc_id)
    if include.get("quiz", True) and quiz:
        parts.append("<h2>Quiz</h2><ol>")
        for q in quiz:
            question = html.escape(q['question'])
            options = ' | '.join(html.escape(o) for o in q.get('options', []))
            parts.append(f"<li><strong>{question}</strong><br>Options: {options}</li>")
        parts.append("</ol>")
    parts.append("</body></html>")
    return "\n".join(parts)

def export_mermaid(doc_id: str, db: Database, include: dict | None = None) -> str:
    chunks = db.get_chunks(doc_id)
    if not chunks:
        return ""
    lines = ["flowchart LR"]
    prev_id = ""
    for i, chunk in enumerate(chunks[:15]):
        node_id = f"C{i}"
        label = chunk.get("content", "")[:30].replace('"', "'")
        lines.append(f'    {node_id}["{label}"]')
        if prev_id:
            lines.append(f"    {prev_id} --> {node_id}")
        prev_id = node_id
    return "\n".join(lines)


def export_flashcards_json(doc_id: str, db: Database, include: dict | None = None) -> str:
    if include and not include.get("flashcards", True):
        return "[]"
    cards = db.get_flashcards(doc_id)
    return json.dumps(cards, indent=2, ensure_ascii=False)


def export_doc_csv(doc_id: str, db: Database, include: dict | None = None) -> str:
    # ponytail: per-document CSV so export respects the selected doc
    doc = db.get_document(doc_id)
    if not doc:
        return ""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Filename", "Title", "Pages", "Size", "Status", "Created"])
    writer.writerow([
        doc["id"],
        _sanitize_csv_cell(doc["filename"]),
        _sanitize_csv_cell(doc.get("title", "")),
        doc.get("page_count", ""),
        doc.get("file_size", ""),
        doc.get("status", ""),
        doc.get("created_at", ""),
    ])
    return output.getvalue()


FORMAT_HANDLERS = {
    "markdown": ("notes.md", export_markdown),
    "html": ("document.html", export_html),
    "json": ("document.json", export_full_json),
    "anki": ("flashcards.txt", export_flashcards_anki),
    "quiz_json": ("quiz.json", export_quiz_json),
    "flashcards_json": ("flashcards.json", export_flashcards_json),
    "mermaid": ("diagram.mmd", export_mermaid),
    "csv": ("document.csv", export_doc_csv),
}


def export_document(doc_id: str, fmt: str, db: Database, include: dict | None = None) -> tuple[str, str]:
    handler = FORMAT_HANDLERS.get(fmt)
    if not handler:
        return "", ""
    default_name, func = handler
    content = func(doc_id, db, include=include)
    return default_name, content


def save_export(content: str, default_name: str, parent_dir: Path | None = None) -> str | None:
    """Save exported content to a file (non-interactive version for IPC)."""
    directory = parent_dir or Path.home() / "Documents"
    directory.mkdir(parents=True, exist_ok=True)
    file_path = directory / default_name
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)

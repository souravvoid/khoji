"""
Action handlers for the Khoji engine IPC protocol.

Each handler receives the message ``payload`` and returns the response dict that
``handle_message`` writes back to the Rust/Tauri bridge. Heavy imports are deferred
to call time so the engine starts quickly and avoids import cycles.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("khoji-engine")

CHAT_CONTEXT_MAX_CHARS = 2000


def handle_ping(payload):
    return {"status": "ok", "result": "pong"}


def handle_process_document(payload):
    from khoji_engine.pipeline.processor import process_document_sync
    from pathlib import Path

    file_path = payload.get("file_path", "")
    if not file_path or not Path(file_path).exists():
        return {"status": "error", "error": f"File not found: {file_path}"}
    result = process_document_sync(file_path)
    return {"status": "ok", "result": {
        "doc_id": result.doc_id,
        "page_count": result.page_count,
        "chunk_count": result.chunk_count,
        "flashcard_count": result.flashcard_count,
        "quiz_count": result.quiz_count,
        "success": result.success,
        "message": result.message,
    }}


def handle_search(payload):
    from khoji_engine.ai.vector_search import get_vector_store
    from khoji_engine.database.db import Database
    from khoji_engine.ai.embeddings import get_embedder

    query = payload.get("query", "")
    limit = payload.get("limit", 10)
    embedder = get_embedder()
    if not embedder.is_loaded():
        embedder.load()
    results = get_vector_store().search(query, limit=limit)
    db = Database()
    enriched = []
    for r in results:
        meta = r.get("metadata", {})
        doc_id = meta.get("doc_id", "")
        chunk_index = meta.get("chunk_index", 0)
        doc = db.get_document(doc_id) if doc_id else None
        chunk_content = ""
        page_number = 0
        if doc_id:
            chunks = db.get_chunks(doc_id)
            for c in chunks:
                if c.get("chunk_index") == chunk_index:
                    chunk_content = c.get("content", "")
                    page_number = c.get("page_number", 0)
                    break
        enriched.append({
            "chunk_id": r["chunk_id"],
            "doc_id": doc_id,
            "score": r["score"],
            "content": chunk_content,
            "page_number": page_number,
            "doc_title": doc.get("title", doc.get("filename", "")) if doc else "",
        })
    return {"status": "ok", "result": enriched}


def handle_generate_flashcards(payload):
    from khoji_engine.database.db import Database
    from khoji_engine.pipeline.content_generator import generate_flashcards

    doc_id = payload.get("doc_id", "")
    db = Database()
    doc = db.get_document(doc_id)
    if not doc:
        return {"status": "error", "error": "Document not found"}
    notes = db.get_notes(doc_id)
    text = notes.get("content", "") if notes else ""
    cards = generate_flashcards(text)
    saved = db.add_flashcards(doc_id, cards)
    return {"status": "ok", "result": [{
        "id": c["id"],
        "front": c["front"],
        "back": c["back"],
        "card_type": c.get("card_type", "basic"),
    } for c in saved]}


def handle_generate_quiz(payload):
    from khoji_engine.database.db import Database
    from khoji_engine.pipeline.content_generator import generate_quiz

    doc_id = payload.get("doc_id", "")
    count = payload.get("count", 10)
    db = Database()
    doc = db.get_document(doc_id)
    if not doc:
        return {"status": "error", "error": "Document not found"}
    notes = db.get_notes(doc_id)
    text = notes.get("content", "") if notes else ""
    questions = generate_quiz(text, num_questions=count)
    saved = db.add_quiz_questions(doc_id, questions)
    return {"status": "ok", "result": [{
        "id": q["id"],
        "question": q["question"],
        "options": q["options"],
        "correct_answer_index": q["correct_answer_index"],
        "explanation": q.get("explanation", ""),
        "difficulty": q.get("difficulty", "medium"),
    } for q in saved]}


def handle_get_documents(payload):
    from khoji_engine.database.db import Database

    db = Database()
    return {"status": "ok", "result": db.list_documents()}


def handle_get_document(payload):
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    db = Database()
    doc = db.get_document(doc_id)
    if doc:
        doc["notes"] = db.get_notes(doc_id)
        doc["flashcards"] = db.get_flashcards(doc_id)
        doc["quiz"] = db.get_quiz_questions(doc_id)
    return {"status": "ok", "result": doc}


def handle_delete_document(payload):
    from khoji_engine.database.db import Database
    from khoji_engine.ai.vector_search import get_vector_store

    doc_id = payload.get("doc_id", "")
    db = Database()
    try:
        get_vector_store().remove_document(doc_id)
    except Exception as e:
        logger.warning("Failed to remove document vectors for %s: %s", doc_id, e)
    success = db.delete_document(doc_id)
    return {"status": "ok", "result": {"deleted": success}}


def handle_export_document(payload):
    from khoji_engine.pipeline.exporter import export_document
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    fmt = payload.get("format", "markdown")
    db = Database()
    filename, content = export_document(doc_id, fmt, db)
    return {"status": "ok", "result": {"filename": filename, "content": content}}


def handle_get_models(payload):
    from khoji_engine.ai.llm import MODEL_PRESETS, GGUF_DIR, get_llm

    active = get_llm().config.model_name
    models = []
    for mid, info in MODEL_PRESETS.items():
        model_path = GGUF_DIR / info["filename"]
        status = "downloaded" if model_path.exists() else "not-installed"
        models.append({
            "id": mid,
            "name": mid,
            "type": "llm",
            "size": f"{info['ram_mb']}MB",
            "status": status,
            "ram_mb": info["ram_mb"],
            "quality": info["quality"],
            "selected": mid == active,
        })
    return {"status": "ok", "result": models}


def handle_chat(payload):
    from khoji_engine.ai.llm import get_llm
    from khoji_engine.database.db import Database

    message = payload.get("message", "")
    doc_id = payload.get("doc_id", "")
    db = Database()
    context = ""
    if doc_id:
        notes = db.get_notes(doc_id)
        if notes:
            context = notes.get("content", "")[:CHAT_CONTEXT_MAX_CHARS]
    prompt = (
        f"Context from document:\n{context}\n\n"
        f"User question: {message}\n\n"
        "Provide a helpful answer based on the document context."
    )
    llm = get_llm()
    if llm.is_loaded():
        response = llm.generate(prompt)
    else:
        response = (
            f"I understand you're asking about: {message}. "
            "The AI model is not yet loaded. Please download and load a model in Settings > Models."
        )
    return {"status": "ok", "result": {"response": response}}


def handle_get_chat_history(payload):
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    db = Database()
    sessions = db.list_chat_sessions(doc_id)
    for session in sessions:
        session["messages"] = db.get_chat_messages(session["id"])
    return {"status": "ok", "result": sessions}


def handle_download_model(payload):
    from khoji_engine.ai.llm import MODEL_PRESETS, LocalLLM, LLMConfig

    model_id = payload.get("model_id", "")
    if model_id not in MODEL_PRESETS:
        return {"status": "error", "error": f"Unknown model: {model_id}"}
    llm = LocalLLM(LLMConfig(model_name=model_id))
    llm.ensure_model()
    return {"status": "ok", "result": {"model_id": model_id, "downloaded": True}}


def handle_check_processing_status(payload):
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    db = Database()
    doc = db.get_document(doc_id)
    status = doc.get("status", "unknown") if doc else "not_found"
    return {"status": "ok", "result": {"doc_id": doc_id, "status": status}}


def handle_get_processing_progress(payload):
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    db = Database()
    doc = db.get_document(doc_id)
    if not doc:
        return {"status": "ok", "result": {"status": "not_found", "progress": 0}}
    status = doc.get("status", "unknown")
    progress_map = {"pending": 0, "processing": 50, "completed": 100, "ready": 100, "failed": 0}
    progress = progress_map.get(status, 0)
    return {"status": "ok", "result": {"status": status, "progress": progress, "doc_id": doc_id}}


def handle_generate_timeline(payload):
    from khoji_engine.database.db import Database
    from khoji_engine.pipeline.structure_generator import generate_timeline

    doc_id = payload.get("doc_id", "")
    db = Database()
    notes = db.get_notes(doc_id)
    text = notes.get("content", "") if notes else ""
    events = generate_timeline(text)
    return {"status": "ok", "result": events}


def handle_generate_mindmap(payload):
    from khoji_engine.database.db import Database
    from khoji_engine.pipeline.structure_generator import generate_mermaid_diagram

    doc_id = payload.get("doc_id", "")
    db = Database()
    notes = db.get_notes(doc_id)
    text = notes.get("content", "") if notes else ""
    mermaid = generate_mermaid_diagram(text)
    return {"status": "ok", "result": mermaid}


def handle_save_notes(payload):
    from khoji_engine.database.db import Database

    doc_id = payload.get("doc_id", "")
    content = payload.get("content", "")
    db = Database()
    result = db.save_notes(doc_id, content)
    return {"status": "ok", "result": result}


def handle_save_chat_session(payload):
    from khoji_engine.database.db import Database

    session_id = payload.get("session_id", "")
    doc_id = payload.get("doc_id")
    title = payload.get("title", "")
    messages = payload.get("messages", [])
    db = Database()
    result = db.save_chat_session(session_id, doc_id, title, messages)
    return {"status": "ok", "result": result}


def handle_select_model(payload):
    from khoji_engine.ai.llm import set_model, MODEL_PRESETS

    model_id = payload.get("model_id", "")
    if model_id not in MODEL_PRESETS:
        return {"status": "error", "message": f"Unknown model: {model_id}"}
    set_model(model_id)
    return {"status": "ok", "result": {"model_id": model_id, "selected": True}}


# Dispatch table: protocol action -> handler function.
ACTION_HANDLERS = {
    "ping": handle_ping,
    "process_document": handle_process_document,
    "search": handle_search,
    "generate_flashcards": handle_generate_flashcards,
    "generate_quiz": handle_generate_quiz,
    "get_documents": handle_get_documents,
    "get_document": handle_get_document,
    "delete_document": handle_delete_document,
    "export_document": handle_export_document,
    "get_models": handle_get_models,
    "chat": handle_chat,
    "get_chat_history": handle_get_chat_history,
    "download_model": handle_download_model,
    "check_processing_status": handle_check_processing_status,
    "get_processing_progress": handle_get_processing_progress,
    "generate_timeline": handle_generate_timeline,
    "generate_mindmap": handle_generate_mindmap,
    "save_notes": handle_save_notes,
    "save_chat_session": handle_save_chat_session,
    "select_model": handle_select_model,
}

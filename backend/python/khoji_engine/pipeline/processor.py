"""
Document processing orchestrator (refactored - no Qt dependencies).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from khoji_engine.pipeline.pdf_extractor import (
    ExtractionResult,
    ExtractedPage,
    extract_pdf,
)
from khoji_engine.pipeline.ocr import has_ocr_engine, ocr_image, ocr_pdf_page

logger = logging.getLogger(__name__)


@dataclass
class ProcessingResult:
    doc_id: str = ""
    success: bool = False
    message: str = ""
    page_count: int = 0
    chunk_count: int = 0
    flashcard_count: int = 0
    quiz_count: int = 0


def _read_text_file(path: Path) -> str:
    # ponytail: text-like uploads must ingest; try sane encodings then lossy
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def _extract_document(path: Path, progress_callback=None) -> tuple[ExtractionResult, str]:
    """Dispatch extraction by file type and fall back to OCR when no text is present."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        extraction = extract_pdf(str(path))
    elif suffix == ".docx":
        from khoji_engine.pipeline.docx_extractor import extract_docx
        extraction = extract_docx(str(path))
    elif suffix == ".pptx":
        from khoji_engine.pipeline.pptx_extractor import extract_pptx
        extraction = extract_pptx(str(path))
    elif suffix == ".epub":
        from khoji_engine.pipeline.epub_extractor import extract_epub
        extraction = extract_epub(str(path))
    elif suffix in {".png", ".jpg", ".jpeg"}:
        ocr_result = ocr_image(str(path))
        extraction = ExtractionResult(filename=path.name, page_count=1)
        if ocr_result.text:
            extraction.pages.append(ExtractedPage(page_number=1, text=ocr_result.text))
            extraction.full_text = ocr_result.text
    elif suffix in {".txt", ".md", ".markdown", ".html", ".htm", ".csv", ".rtf"}:
        # ponytail: text-like files are read directly; markdown/html/csv stay as prose
        text = _read_text_file(path)
        extraction = ExtractionResult(filename=path.name, page_count=1)
        extraction.pages.append(ExtractedPage(page_number=1, text=text))
        extraction.full_text = text
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    if not extraction.full_text.strip() and has_ocr_engine():
        logger.info("No extractable text, falling back to OCR...")
        ocr_texts = []
        for page_num in range(1, extraction.page_count + 1):
            if progress_callback:
                progress_callback("ocr", 10 + int((page_num / extraction.page_count) * 20))
            ocr_result = ocr_pdf_page(str(path), page_num)
            if ocr_result:
                ocr_texts.append(ocr_result.text)
        full_text = "\n\n".join(ocr_texts)
    else:
        full_text = extraction.full_text

    return extraction, full_text


def _run_embeddings(doc_id: str, chunks: list, progress_callback=None) -> bool:
    """Embed chunk texts and index them in the vector store. Returns True on success."""
    if progress_callback:
        progress_callback("embedding", 70)
    try:
        from khoji_engine.ai.embeddings import get_embedder
        from khoji_engine.ai.vector_search import get_vector_store

        embedder = get_embedder()
        if embedder.load():
            texts = [c["content"] for c in chunks]
            chunk_ids = [f"{doc_id}_{c['chunk_index']}" for c in chunks]
            embeddings = embedder.embed(texts)

            vector_store = get_vector_store()
            metadata = [{"doc_id": doc_id, "chunk_index": c["chunk_index"]} for c in chunks]
            vector_store.add_vectors(chunk_ids, embeddings, metadata)
            return True
        logger.warning("Embedder failed to load; skipping embeddings")
        return False
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return False


def _generate_study_material(db, doc_id: str, full_text: str, progress_callback=None) -> tuple[int, int]:
    """Generate and persist flashcards and quiz questions for a document."""
    from khoji_engine.pipeline.content_generator import generate_flashcards, generate_quiz

    if progress_callback:
        progress_callback("flashcards", 85)
    cards = generate_flashcards(full_text)
    saved_cards = db.add_flashcards(doc_id, cards)
    flashcard_count = len(saved_cards)

    if progress_callback:
        progress_callback("quiz", 92)
    quiz = generate_quiz(full_text)
    saved_quiz = db.add_quiz_questions(doc_id, quiz)
    quiz_count = len(saved_quiz)

    return flashcard_count, quiz_count


def process_document_sync(
    file_path: str,
    db=None,
    *,
    extract_embeddings: bool = True,
    progress_callback=None,
) -> ProcessingResult:
    """
    Synchronous document processing pipeline.
    This is the refactored version - no QThread, no Qt dependencies.
    """
    from khoji_engine.pipeline.markdown_generator import chunk_markdown, generate_markdown
    from khoji_engine.database.db import Database

    if db is None:
        db = Database()

    path = Path(file_path)
    result = ProcessingResult()

    if not path.exists():
        result.message = f"File not found: {file_path}"
        return result

    existing = db.document_exists(str(path.resolve()))
    if existing:
        if existing.get("status") == "ready":
            result.doc_id = existing["id"]
            result.success = True
            result.page_count = existing.get("page_count", 0)
            result.chunk_count = len(db.get_chunks(result.doc_id))
            result.flashcard_count = len(db.get_flashcards(result.doc_id))
            result.quiz_count = len(db.get_quiz_questions(result.doc_id))
            result.message = (
                f"Document already processed ({result.chunk_count} chunks, "
                f"{result.flashcard_count} flashcards, {result.quiz_count} quiz questions)"
            )
            return result
        else:
            logger.info("Incomplete document ingestion detected, deleting and restarting...")
            db.delete_document(existing["id"])

    if progress_callback:
        progress_callback("ocr", 10)

    try:
        extraction, full_text = _extract_document(path, progress_callback)
    except ValueError as e:
        result.message = str(e)
        return result

    if not full_text.strip():
        result.message = "No text could be extracted from the document"
        return result

    if progress_callback:
        progress_callback("extract", 30)

    doc = db.create_document(
        filename=path.name,
        file_path=str(path.resolve()),
        file_size=path.stat().st_size,
        title=path.stem,
        page_count=extraction.page_count,
    )
    result.doc_id = doc["id"]

    if progress_callback:
        progress_callback("markdown", 40)

    markdown_content = generate_markdown(
        filename=path.name,
        text=full_text,
        title=path.stem,
        page_count=extraction.page_count,
        source_path=str(path.absolute()),
    )
    db.upsert_notes(result.doc_id, markdown_content)

    if progress_callback:
        progress_callback("chunking", 55)

    chunks = chunk_markdown(markdown_content)
    db.add_chunks(result.doc_id, chunks)
    result.chunk_count = len(chunks)

    if extract_embeddings:
        if not _run_embeddings(result.doc_id, chunks, progress_callback):
            result.message += " (warning: embeddings failed; search may be empty)"

    flashcard_count, quiz_count = _generate_study_material(
        db, result.doc_id, full_text, progress_callback
    )
    result.flashcard_count = flashcard_count
    result.quiz_count = quiz_count

    db.update_document(result.doc_id, status="ready")

    if progress_callback:
        progress_callback("complete", 100)

    result.success = True
    result.page_count = extraction.page_count
    result.message = f"Successfully processed {len(chunks)} chunks, {flashcard_count} flashcards, {quiz_count} quiz questions"
    return result

"""DOCX text extraction using python-docx.

Extracts text paragraph-by-paragraph with page-break awareness.
Since .docx has no real pages, pages are approximated by splitting
on explicit page breaks or every ~40 lines.
"""

from __future__ import annotations

from pathlib import Path

from khoji_engine.pipeline.pdf_extractor import (
    ExtractedPage,
    ExtractionResult,
    _clean_extracted_text,
)

PAGE_BREAK_LINE = "\x0c"
LINES_PER_PAGE = 40


def extract_docx(file_path: str | Path) -> ExtractionResult:
    """Extract text from a .docx file, returning page-approximated results."""
    file_path = Path(file_path)
    result = ExtractionResult(filename=file_path.name, page_count=0)

    try:
        from docx import Document
    except ImportError:
        result.errors.append("python-docx is not installed")
        return result

    try:
        doc = Document(str(file_path))
    except Exception as e:
        result.errors.append(f"Failed to open DOCX: {e}")
        return result

    paragraphs: list[str] = []
    for p in doc.paragraphs:
        text = p.text
        if not text:
            continue
        paragraphs.append(text)

    if not paragraphs:
        result.errors.append("No text found in document")
        return result

    full_clean = _clean_extracted_text("\n".join(paragraphs))
    if not full_clean:
        result.errors.append("Document contains only whitespace")
        return result

    lines = full_clean.split("\n")
    current_page_lines: list[str] = []
    pages: list[ExtractedPage] = []
    offset = 0

    for line in lines:
        if line == PAGE_BREAK_LINE:
            if current_page_lines:
                _finalize_page(current_page_lines, pages, offset)
                offset += len("\n".join(current_page_lines))
                current_page_lines = []
            continue

        current_page_lines.append(line)
        if len(current_page_lines) >= LINES_PER_PAGE:
            _finalize_page(current_page_lines, pages, offset)
            offset += len("\n".join(current_page_lines))
            current_page_lines = []

    if current_page_lines:
        _finalize_page(current_page_lines, pages, offset)

    result.page_count = len(pages)
    result.pages = pages
    result.full_text = full_clean
    return result


def _finalize_page(
    lines: list[str],
    pages: list[ExtractedPage],
    offset: int,
) -> None:
    text = "\n".join(lines)
    clean = _clean_extracted_text(text)
    if not clean:
        return
    pages.append(
        ExtractedPage(
            page_number=len(pages) + 1,
            text=clean,
            char_offset=offset,
            char_length=len(clean),
        )
    )

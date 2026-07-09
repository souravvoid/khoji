"""PDF text extraction using PyMuPDF (fitz).

Replaces the Rust pdf-extract crate from pipeline.rs.
Extracts text page-by-page with structure hints.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


@dataclass
class ExtractedPage:
    page_number: int
    text: str
    char_offset: int = 0
    char_length: int = 0


@dataclass
class ExtractionResult:
    filename: str
    page_count: int
    pages: list[ExtractedPage] = field(default_factory=list)
    full_text: str = ""
    has_images: bool = False
    errors: list[str] = field(default_factory=list)


def extract_pdf(file_path: str | Path) -> ExtractionResult:
    """Extract text from a PDF file.

    Mirrors the Rust `extract_text_from_pdf` in pipeline.rs but uses PyMuPDF.
    """
    file_path = Path(file_path)
    result = ExtractionResult(filename=file_path.name, page_count=0)

    try:
        doc = fitz.open(str(file_path))
    except Exception as e:
        result.errors.append(f"Failed to open PDF: {e}")
        return result

    result.page_count = doc.page_count
    full_text_parts: list[str] = []
    offset = 0

    for page_idx in range(doc.page_count):
        page = doc.load_page(page_idx)
        try:
            text = page.get_text("text")
        except Exception as e:
            logger.warning("PDF page %d text extraction failed: %s", page_idx + 1, e)
            text = ""

        if not text.strip():
            continue

        clean = _clean_extracted_text(text)
        if not clean:
            continue

        ep = ExtractedPage(
            page_number=page_idx + 1,
            text=clean,
            char_offset=offset,
            char_length=len(clean),
        )
        result.pages.append(ep)
        full_text_parts.append(clean)
        offset += len(clean)

        if not result.has_images:
            result.has_images = len(page.get_images()) > 0

    result.full_text = "\n\n".join(full_text_parts)
    doc.close()
    return result


def extract_pdf_preview(file_path: str | Path, max_pages: int = 3) -> str:
    """Quick extraction of first N pages for preview."""
    file_path = Path(file_path)
    try:
        doc = fitz.open(str(file_path))
    except Exception as e:
        logger.warning("Failed to open PDF for preview: %s", e)
        return ""

    parts: list[str] = []
    for i in range(min(max_pages, doc.page_count)):
        page = doc.load_page(i)
        try:
            text = page.get_text("text")
        except Exception as e:
            logger.warning("PDF preview page %d text extraction failed: %s", i + 1, e)
            text = ""
        if text.strip():
            parts.append(f"--- Page {i + 1} ---\n{_clean_extracted_text(text)}")

    doc.close()
    return "\n\n".join(parts)


def get_page_count(file_path: str | Path) -> int:
    """Get PDF page count without full extraction."""
    try:
        doc = fitz.open(str(file_path))
        count = doc.page_count
        doc.close()
        return count
    except Exception as e:
        logger.warning("Failed to read PDF page count: %s", e)
        return 0


def _clean_extracted_text(text: str) -> str:
    """Clean raw PDF text output (matches Rust pipeline.rs logic)."""
    text = re.sub(r"\x00", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

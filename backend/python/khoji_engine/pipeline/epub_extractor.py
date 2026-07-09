"""EPUB text extraction using EbookLib.

Extracts text from each chapter/section. Each chapter is
represented as a "page" in the ExtractionResult.
"""

from __future__ import annotations

from pathlib import Path

from khoji_engine.pipeline.pdf_extractor import (
    ExtractedPage,
    ExtractionResult,
    _clean_extracted_text,
)


def extract_epub(file_path: str | Path) -> ExtractionResult:
    """Extract text from an .epub file, one page per chapter."""
    file_path = Path(file_path)
    result = ExtractionResult(filename=file_path.name, page_count=0)

    try:
        import ebooklib
        from ebooklib import epub
    except ImportError:
        result.errors.append("EbookLib is not installed")
        return result

    try:
        book = epub.read_epub(str(file_path))
    except Exception as e:
        result.errors.append(f"Failed to open EPUB: {e}")
        return result

    from html.parser import HTMLParser

    class _TextExtractor(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self._text_parts: list[str] = []
            self._skip = False

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            tag_lower = tag.lower()
            if tag_lower in {"script", "style", "nav"}:
                self._skip = True

        def handle_endtag(self, tag: str) -> None:
            tag_lower = tag.lower()
            if tag_lower in {"script", "style", "nav"}:
                self._skip = False
            if tag_lower in {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br"}:
                self._text_parts.append("\n")

        def handle_data(self, data: str) -> None:
            if not self._skip:
                stripped = data.strip()
                if stripped:
                    self._text_parts.append(stripped + " ")

        def text(self) -> str:
            return "".join(self._text_parts).strip()

    full_text_parts: list[str] = []
    offset = 0

    for item in book.get_items():
        if item.get_type() != ebooklib.ITEM_DOCUMENT:
            continue

        try:
            content = item.get_content()
            if not content:
                continue
            html_content = content.decode("utf-8", errors="replace")
        except Exception:
            continue

        extractor = _TextExtractor()
        try:
            extractor.feed(html_content)
        except Exception:
            continue

        chapter_text = extractor.text()
        if not chapter_text:
            continue

        clean = _clean_extracted_text(chapter_text)
        if not clean:
            continue

        ep = ExtractedPage(
            page_number=len(result.pages) + 1,
            text=clean,
            char_offset=offset,
            char_length=len(clean),
        )
        result.pages.append(ep)
        full_text_parts.append(clean)
        offset += len(clean)

    result.page_count = len(result.pages)
    result.full_text = "\n\n".join(full_text_parts)

    if not result.pages:
        result.errors.append("No readable text content found in EPUB")

    return result

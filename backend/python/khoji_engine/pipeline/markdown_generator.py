"""Markdown generator for documents.

Mirrors the Rust `generate_markdown` in pipeline.rs.
Creates structured markdown from extracted text with document metadata.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def generate_markdown(
    filename: str,
    text: str,
    *,
    title: str | None = None,
    page_count: int | None = None,
    source_path: str | None = None,
) -> str:
    """Generate a clean Markdown document from extracted text."""
    doc_title = title or Path(filename).stem
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    word_count = len(text.split())

    sections: list[str] = []
    sections.append(f"# {doc_title}\n")
    sections.append(f"> Source: `{filename}`  ")
    if page_count:
        sections.append(f"> Pages: {page_count}  ")
    sections.append(f"> Words: {word_count:,}  ")
    sections.append(f"> Extracted: {now}\n")

    paragraphs = _split_into_paragraphs(text)

    for para in paragraphs:
        stripped = para.strip()
        if not stripped:
            continue

        if _is_heading(stripped):
            level = _detect_heading_level(stripped)
            sections.append(f"{'#' * level} {stripped}\n")
        elif _is_list_item(stripped):
            sections.append(f"- {stripped.lstrip('-*•').strip()}\n")
        elif _is_table_row(stripped):
            sections.append(f"| {stripped} |\n")
        else:
            sections.append(f"{stripped}\n")

    return "\n".join(sections)


def chunk_markdown(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[dict]:
    """Split text into overlapping chunks for embedding/indexing.

    Mirrors the Rust chunk_text logic from pipeline.rs.
    """
    chunks: list[dict] = []
    start = 0
    idx = 0

    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end]

        last_period = chunk_text.rfind(".")
        last_newline = chunk_text.rfind("\n")
        split_at = max(last_period, last_newline)

        if split_at > chunk_size * 0.5 and end < len(text):
            chunk_text = chunk_text[: split_at + 1]
            end = start + split_at + 1

        if chunk_text.strip():
            chunks.append(
                {
                    "chunk_index": idx,
                    "content": chunk_text.strip(),
                    "char_offset": start,
                    "char_length": len(chunk_text.strip()),
                }
            )
            idx += 1

        start = end - overlap
        if start <= 0 and end >= len(text):
            break

    return chunks


def _split_into_paragraphs(text: str) -> list[str]:
    blocks = re.split(r"\n{2,}", text)
    return [b.strip() for b in blocks if b.strip()]


def _is_heading(text: str) -> bool:
    if re.match(r"^(chapter|section|part|module|unit)\s+\d+", text, re.IGNORECASE):
        return True
    if re.match(r"^[A-Z][A-Z\s]{5,}$", text):
        return True
    if len(text) < 80 and not text.endswith(".") and text[0:1].isupper():
        words = text.split()
        if len(words) <= 8 and all(w[0:1].isupper() or not w[0:1].isalpha() for w in words):
            return True
    return False


def _detect_heading_level(text: str) -> int:
    if re.match(r"^(chapter|part)\s+\d+", text, re.IGNORECASE):
        return 2
    if re.match(r"^(section|module|unit)\s+\d+", text, re.IGNORECASE):
        return 3
    if re.match(r"^[A-Z][A-Z\s]{5,}$", text):
        return 2
    return 3


def _is_list_item(text: str) -> bool:
    return bool(re.match(r"^[-*•]\s+", text))


def _is_table_row(text: str) -> bool:
    return "|" in text and not text.startswith("#")

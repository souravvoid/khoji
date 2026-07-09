"""Timeline and mind map generation from document text."""

from __future__ import annotations

import re
from typing import Any


_DATE_PATTERNS = [
    re.compile(r"\b(19\d{2}|20[0-2]\d)\b"),
    re.compile(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19\d{2}|20[0-2]\d)\b"),
    re.compile(r"\b(the\s+)?(19\d{2}|20[0-2]\d)s\b"),
]

_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
_BULLET_RE = re.compile(r"^[\-\*]\s+(.+)$", re.MULTILINE)
_DEFINITION_RE = re.compile(r"^(.+?)\s*[-–—:]\s+(.+)$", re.MULTILINE)


def generate_timeline(text: str) -> list[dict[str, str]]:
    """Extract timeline events from text based on date mentions.

    Returns up to 20 chronologically sorted events, each with
    ``date``, ``title``, and ``description`` keys.
    """
    if not text or not text.strip():
        return []

    sentences = _split_sentences(text)
    events: list[dict[str, str]] = []
    seen: set[str] = set()

    for sent in sentences:
        if len(events) >= 20:
            break

        matches = _find_dates(sent)
        for date_str in matches:
            key = f"{date_str}|{sent}"
            if key in seen:
                continue
            seen.add(key)

            title = _make_title(sent)
            events.append({
                "date": date_str,
                "title": title,
                "description": sent,
            })

    events.sort(key=_date_sort_key)
    return events[:20]


def generate_mind_map(text: str) -> dict[str, Any]:
    """Extract a topic / subtopic tree from document text.

    Returns a dict with ``topic`` (str) and ``nodes`` (list), each node
    having ``label`` and ``children``.  Max depth 3, max 4 subtopics
    with up to 4 children each.
    """
    if not text or not text.strip():
        return {"topic": "", "nodes": []}

    topic = _extract_topic(text)
    nodes: list[dict[str, Any]] = []

    headings = _HEADING_RE.findall(text)

    level2_headings: list[str] = []
    for level, title in headings:
        if level == "##":
            cleaned = title.strip()
            if cleaned and len(level2_headings) < 4:
                level2_headings.append(cleaned)

    if not level2_headings:
        level2_headings = _fallback_subtopics(text)

    for sub in level2_headings:
        children = _extract_children(text, sub)
        nodes.append({"label": _strip_markdown(sub), "children": children})

    return {"topic": topic, "nodes": nodes}


def generate_mermaid_diagram(text: str) -> str:
    """Generate a Mermaid flowchart string from the mind map of *text*."""
    mind_map = generate_mind_map(text)
    topic = mind_map["topic"]
    nodes = mind_map["nodes"]

    if not topic:
        return "flowchart LR\n    A[\"\"]"

    lines: list[str] = ["flowchart LR"]
    topic_id = _safe_id(topic)
    lines.append(f'    {topic_id}["{_escape(topic)}"]')

    node_counter = 1
    for sub in nodes:
        sub_id = f"N{node_counter}"
        node_counter += 1
        lines.append(f'    {sub_id}["{_escape(sub["label"])}"]')
        lines.append(f"    {topic_id} --> {sub_id}")

        for child in sub["children"]:
            child_id = f"N{node_counter}"
            node_counter += 1
            lines.append(f'    {child_id}["{_escape(child["label"])}"]')
            lines.append(f"    {sub_id} --> {child_id}")

    return "\n".join(lines)


# ── Internal helpers ────────────────────────────────────────────

def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|(?<=[.!?])\n|\n\s*\n", text)
    cleaned = []
    for s in parts:
        s = s.strip()
        s = re.sub(r"^#{1,6}\s+.*?(?:\n|$)", "", s).strip()
        if len(s) > 10 and not re.match(r"^[\-\*\+]\s", s):
            cleaned.append(_strip_markdown(s))
    return cleaned


def _find_dates(sentence: str) -> list[str]:
    found = set()

    for year_match in _DATE_PATTERNS[0].finditer(sentence):
        found.add(year_match.group(0))

    for month_match in _DATE_PATTERNS[1].finditer(sentence):
        found.add(month_match.group(0))

    for decade_match in _DATE_PATTERNS[2].finditer(sentence):
        raw = decade_match.group(0)
        normalized = raw.lower().replace("the ", "").strip()
        found.add(normalized)

    return sorted(found)


def _make_title(sentence: str, max_words: int = 8) -> str:
    words = sentence.split()
    title = " ".join(words[:max_words])
    if title.endswith((".", "!", "?")):
        title = title[:-1]
    return title


def _date_sort_key(event: dict[str, str]) -> tuple[int, int, int]:
    date_str = event["date"]
    year_match = re.search(r"(19\d{2}|20[0-2]\d)", date_str)
    year = int(year_match.group(0)) if year_match else 9999

    month_map = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    month = 0
    for name, num in month_map.items():
        if name in date_str.lower():
            month = num
            break

    return (year, month, 0)


def _extract_topic(text: str) -> str:
    heading = _HEADING_RE.search(text)
    if heading:
        return _strip_markdown(heading.group(2).strip())

    first = _split_sentences(text)
    if first:
        words = first[0].split()
        return _strip_markdown(" ".join(words[:10]).rstrip(".!:?"))

    return ""


def _fallback_subtopics(text: str) -> list[str]:
    sentences = _split_sentences(text)
    result: list[str] = []
    for s in sentences:
        if len(s) > 20 and len(result) < 4:
            words = s.split()
            label = " ".join(words[:6]).rstrip(".!:?")
            result.append(_strip_markdown(label))
    return result


def _extract_children(text: str, parent_heading: str) -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []
    seen_titles: set[str] = set()

    lines = text.split("\n")
    in_section = False
    section_lines: list[str] = []

    for line in lines:
        h_match = _HEADING_RE.match(line)
        if h_match:
            level, title = h_match.groups()
            cleaned_title = title.strip()
            if level == "##" and cleaned_title.lower() == parent_heading.lower():
                in_section = True
                section_lines = []
                continue
            if in_section and level in ("#", "##"):
                break
            if in_section and level == "###":
                cleaned = _strip_markdown(cleaned_title)
                if cleaned and len(children) < 4 and cleaned not in seen_titles:
                    seen_titles.add(cleaned)
                    children.append({"label": cleaned, "children": []})
            continue

        if in_section:
            section_lines.append(line)

    if not children:
        defs = _DEFINITION_RE.findall("\n".join(section_lines)) if section_lines else []
        for term, _ in defs:
            cleaned = _strip_markdown(term)
            if cleaned and len(children) < 4 and cleaned not in seen_titles:
                seen_titles.add(cleaned)
                children.append({"label": cleaned, "children": []})

    if not children:
        bullets = _BULLET_RE.findall("\n".join(section_lines)) if section_lines else []
        for item in bullets:
            cleaned = _strip_markdown(item)
            if cleaned and len(children) < 4 and cleaned not in seen_titles:
                seen_titles.add(cleaned)
                children.append({"label": cleaned, "children": []})

    return children


def _strip_markdown(text: str) -> str:
    result = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    result = re.sub(r"`{1,3}(.*?)`{1,3}", r"\1", result)
    result = re.sub(r"^[\-\*\+]\s+", "", result)
    result = re.sub(r"^#{1,6}\s+", "", result)
    return result.strip()


def _safe_id(text: str) -> str:
    identifier = re.sub(r"[^a-zA-Z0-9_]", "_", text)
    if not identifier or identifier[0].isdigit():
        identifier = "n" + identifier
    return identifier[:60]


def _escape(text: str) -> str:
    return text.replace('"', "#quot;").replace("\n", " ")

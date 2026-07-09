"""Flashcard and Quiz generation from document text.

Port of the Rust generate_flashcards/generate_quiz from pipeline.rs.
Uses rule-based extraction (template-based, no LLM needed for MVP).
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass


@dataclass
class Flashcard:
    front: str
    back: str
    card_type: str = "basic"


@dataclass
class QuizQuestion:
    question: str
    options: list[str]
    correct_answer_index: int
    explanation: str = ""
    difficulty: str = "medium"


def generate_flashcards(text: str, max_cards: int = 20) -> list[Flashcard]:
    """Extract flashcard-style Q&A pairs from text.

    Mirrors Rust generate_flashcards logic: sentence-pair extraction.
    """
    cards: list[Flashcard] = []
    sentences = _split_sentences(text)

    for sent in sentences:
        if len(cards) >= max_cards:
            break

        if _is_definition(sent):
            card = _definition_to_card(sent)
            if card:
                cards.append(card)
        elif _is_fact(sent):
            card = _fact_to_card(sent)
            if card:
                cards.append(card)

    if len(cards) < 5 and len(sentences) > 10:
        for i in range(0, min(len(sentences) - 1, max_cards - len(cards)), 2):
            s1 = sentences[i].strip()
            s2 = sentences[i + 1].strip() if i + 1 < len(sentences) else ""
            if len(s1) > 20 and len(s2) > 20:
                cards.append(Flashcard(front=s1, back=s2, card_type="context"))

    random.shuffle(cards)
    return cards[:max_cards]


def generate_quiz(text: str, num_questions: int = 10) -> list[QuizQuestion]:
    """Generate quiz questions from text.

    Mirrors Rust generate_quiz: sentence-based question generation.
    """
    questions: list[QuizQuestion] = []
    sentences = _split_sentences(text)

    for sent in sentences:
        if len(questions) >= num_questions:
            break

        if _is_definition(sent):
            q = _definition_to_quiz(sent, sentences)
            if q:
                questions.append(q)
        elif _is_fact(sent):
            q = _fact_to_quiz(sent, sentences)
            if q:
                questions.append(q)

    random.shuffle(questions)
    return questions[:num_questions]


# ── Internal helpers ────────────────────────────────────────────

def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in parts if len(s.strip()) > 15]


def _is_definition(sentence: str) -> bool:
    patterns = [
        r"^(.+?)\s+(?:is|are|refers to|means|denotes)\s+(.+)$",
        r"^(.+?)\s*[-–—:]\s+(.+)$",
    ]
    return any(re.match(p, sentence, re.IGNORECASE) for p in patterns)


def _is_fact(sentence: str) -> bool:
    return bool(re.search(r"\b\d+\b", sentence)) or bool(
        re.search(r"\b(always|never|typically|usually|generally)\b", sentence, re.IGNORECASE)
    )


def _definition_to_card(sent: str) -> Flashcard | None:
    m = re.match(r"^(.+?)\s+(?:is|are|refers to|means|denotes)\s+(.+)$", sent, re.IGNORECASE)
    if m:
        return Flashcard(front=f"What is {m.group(1).strip()}?", back=m.group(2).strip())
    m = re.match(r"^(.+?)\s*[-–—:]\s+(.+)$", sent, re.IGNORECASE)
    if m:
        return Flashcard(front=m.group(1).strip(), back=m.group(2).strip())
    return None


def _fact_to_card(sent: str) -> Flashcard | None:
    if len(sent) > 300:
        return None
    return Flashcard(front=sent, back="(See source document)")


def _definition_to_quiz(sent: str, all_sentences: list[str]) -> QuizQuestion | None:
    m = re.match(r"^(.+?)\s+(?:is|are|refers to|means|denotes)\s+(.+)$", sent, re.IGNORECASE)
    if not m:
        return None
    term = m.group(1).strip()
    definition = m.group(2).strip()

    distractors = _get_distractors(definition, all_sentences, 3)
    options = [definition] + distractors
    random.shuffle(options)
    idx = options.index(definition)

    return QuizQuestion(
        question=f"What is {term}?",
        options=options,
        correct_answer_index=idx,
        explanation=sent,
        difficulty="medium",
    )


def _fact_to_quiz(sent: str, all_sentences: list[str]) -> QuizQuestion | None:
    if len(sent) > 200:
        return None

    numbers = re.findall(r"\d+", sent)
    if numbers:
        q_text = sent.replace(numbers[0], "___")
        distractors = [str(int(numbers[0]) + d) for d in [-5, -2, 3, 7]]
        options = [numbers[0]] + distractors[:3]
        random.shuffle(options)
        return QuizQuestion(
            question=q_text,
            options=options,
            correct_answer_index=options.index(numbers[0]),
            explanation=sent,
            difficulty="easy",
        )
    return None


def _get_distractors(answer: str, all_sentences: list[str], count: int = 3) -> list[str]:
    candidates = [s for s in all_sentences if s != answer and 10 < len(s) < 300]
    random.shuffle(candidates)
    return candidates[:count]

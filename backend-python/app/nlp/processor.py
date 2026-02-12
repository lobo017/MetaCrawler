"""Lightweight NLP processor with pluggable analysis tasks."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "positive",
    "success",
    "up",
    "fast",
    "better",
    "love",
}
NEGATIVE_WORDS = {
    "bad",
    "poor",
    "negative",
    "fail",
    "down",
    "slow",
    "worse",
    "error",
    "hate",
}


def analyze_text(text: str, tasks: list[str] | None = None) -> dict[str, Any]:
    requested = set(task.lower() for task in (tasks or ["sentiment", "entities", "keywords"]))
    result: dict[str, Any] = {"length": len(text), "tasks": sorted(requested)}

    if "sentiment" in requested:
        result["sentiment"] = _analyze_sentiment(text)
    if "entities" in requested or "ner" in requested:
        result["entities"] = _extract_entities(text)
    if "keywords" in requested:
        result["keywords"] = _extract_keywords(text)

    return result


def _analyze_sentiment(text: str) -> dict[str, float]:
    tokens = [token.lower() for token in re.findall(r"[A-Za-z]+", text)]
    if not tokens:
        return {"polarity": 0.0, "subjectivity": 0.0}

    pos_hits = sum(token in POSITIVE_WORDS for token in tokens)
    neg_hits = sum(token in NEGATIVE_WORDS for token in tokens)

    polarity = (pos_hits - neg_hits) / max(len(tokens), 1)
    subjectivity = (pos_hits + neg_hits) / max(len(tokens), 1)
    return {"polarity": round(polarity, 4), "subjectivity": round(subjectivity, 4)}


def _extract_entities(text: str) -> list[dict[str, str]]:
    candidates = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", text)
    seen = set()
    entities = []
    for candidate in candidates:
        normalized = candidate.strip()
        if len(normalized) < 2 or normalized in seen:
            continue
        seen.add(normalized)
        entities.append({"text": normalized, "label": "PROPN"})
    return entities


def _extract_keywords(text: str, limit: int = 8) -> list[str]:
    tokens = [token.lower() for token in re.findall(r"[A-Za-z]{4,}", text)]
    stopwords = {"that", "with", "from", "this", "have", "were", "your", "about", "http", "https"}
    filtered = [token for token in tokens if token not in stopwords]
    ranked = Counter(filtered).most_common(limit)
    return [token for token, _ in ranked]

def answer_question(text: str, question: str) -> dict[str, Any]:
    """
    Basic extractive QA: Finds the sentence in the text that best matches the question words.
    Replace this logic with an LLM (OpenAI/HuggingFace) for production use.
    """
    if not text or not question:
        return {"answer": "No context provided.", "confidence": 0.0}

    # Simple sentence splitting
    sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', text)
    
    question_words = set(re.findall(r"\w+", question.lower()))
    best_score = 0
    best_sentence = "I couldn't find the answer in the text."

    for sentence in sentences:
        sentence_words = set(re.findall(r"\w+", sentence.lower()))
        if not sentence_words:
            continue
        
        # Calculate overlap score (Jaccard similarityish)
        intersection = question_words.intersection(sentence_words)
        score = len(intersection) / len(sentence_words) if sentence_words else 0
        
        if score > best_score:
            best_score = score
            best_sentence = sentence

    return {
        "answer": best_sentence,
        "confidence": round(best_score, 2),
        "source_preview": best_sentence[:50] + "..."
    }
"""Lightweight NLP processor with pluggable analysis tasks."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

POSITIVE_WORDS = { "good", "great", "excellent", "positive", "success", "love", "fast" }
NEGATIVE_WORDS = { "bad", "poor", "negative", "fail", "slow", "error", "hate" }

def analyze_text(text: str, tasks: list[str] | None = None) -> dict[str, Any]:
    # (Keep existing analyze_text logic as-is)
    requested = set(task.lower() for task in (tasks or ["sentiment", "entities", "keywords"]))
    result: dict[str, Any] = {"length": len(text), "tasks": sorted(requested)}

    if "sentiment" in requested:
        result["sentiment"] = _analyze_sentiment(text)
    if "entities" in requested or "ner" in requested:
        result["entities"] = _extract_entities(text)
    if "keywords" in requested:
        result["keywords"] = _extract_keywords(text)

    return result

# ---------------------------------------------------------------------------
# Concept 1: Synonym / Concept Expansion
# Bridges vocabulary gaps so "cost" matches content about "price" or "expense".
# Each group is bidirectional: every word in a list is treated as a synonym of
# every other word in that same list.
# ---------------------------------------------------------------------------
SYNONYM_GROUPS: list[set[str]] = [
    {"cost", "price", "expense", "fee", "charge", "rate"},
    {"buy", "purchase", "acquire", "order"},
    {"sell", "offer", "provide", "supply", "distribute"},
    {"product", "item", "good", "merchandise", "offering"},
    {"fast", "quick", "rapid", "speedy", "swift"},
    {"big", "large", "huge", "massive", "enormous"},
    {"small", "tiny", "little", "compact", "miniature"},
    {"start", "begin", "launch", "initiate", "commence", "founded"},
    {"end", "finish", "complete", "conclude", "terminate"},
    {"make", "create", "build", "develop", "construct", "produce"},
    {"use", "utilize", "employ", "leverage", "apply"},
    {"help", "assist", "support", "aid"},
    {"goal", "objective", "purpose", "aim", "target", "mission"},
    {"problem", "issue", "challenge", "difficulty", "obstacle"},
    {"fix", "solve", "resolve", "repair", "address"},
    {"money", "revenue", "income", "profit", "earnings", "funding"},
    {"people", "users", "customers", "clients", "audience", "employees"},
    {"location", "place", "area", "region", "site", "address"},
    {"company", "organization", "firm", "business", "enterprise", "corporation"},
    {"important", "critical", "crucial", "essential", "significant", "key"},
    {"show", "display", "demonstrate", "present", "illustrate", "reveal"},
    {"change", "modify", "update", "alter", "revise", "transform"},
    {"old", "previous", "former", "legacy", "outdated"},
    {"new", "modern", "recent", "latest", "current", "novel"},
    {"feature", "capability", "functionality", "function", "ability"},
    {"data", "information", "content", "details", "records"},
    {"about", "regarding", "concerning", "related"},
]

# Pre-build a fast lookup: word -> set of its synonyms
_SYNONYM_MAP: dict[str, set[str]] = {}
for _group in SYNONYM_GROUPS:
    for _word in _group:
        _SYNONYM_MAP.setdefault(_word, set()).update(_group - {_word})


def _expand_with_synonyms(text: str) -> str:
    """Append synonyms of every token to the text (used to widen TF-IDF matching)."""
    tokens = re.findall(r"\w+", text.lower())
    extras: list[str] = []
    for tok in tokens:
        syns = _SYNONYM_MAP.get(tok)
        if syns:
            extras.extend(syns)
    return text + " " + " ".join(extras) if extras else text


# ---------------------------------------------------------------------------
# Concept 2: Question-Type Classification
# Detects the *intent* behind the question and rewards sentences whose shape
# matches that intent (dates for WHEN, proper nouns for WHO, numbers for
# HOW MANY, etc.)
# ---------------------------------------------------------------------------
_DATE_PATTERN = re.compile(
    r"\b(\d{4}|\d{1,2}/\d{1,2}|\d{1,2}-\d{1,2}|"
    r"january|february|march|april|may|june|july|august|september|october|november|december|"
    r"founded|established|launched|started|created|born|died)\b",
    re.IGNORECASE,
)
_NUMBER_PATTERN = re.compile(r"\b\d[\d,.]*\b")
_PROPER_NOUN_PATTERN = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b")
_LOCATION_HINTS = re.compile(
    r"\b(city|country|state|street|avenue|headquartered|located|based in|region|district)\b",
    re.IGNORECASE,
)
_REASON_HINTS = re.compile(r"\b(because|therefore|reason|due to|caused by|since|so that|in order to)\b", re.IGNORECASE)


def _classify_question(question: str) -> str:
    """Return a coarse question type: WHO / WHEN / WHERE / HOW_MANY / WHY / WHAT."""
    q = question.lower().strip()
    if q.startswith("who ") or "who is" in q or "who was" in q or "who are" in q:
        return "WHO"
    if q.startswith("when ") or "what year" in q or "what date" in q:
        return "WHEN"
    if q.startswith("where ") or "what location" in q or "what place" in q:
        return "WHERE"
    if "how many" in q or "how much" in q or "what number" in q:
        return "HOW_MANY"
    if q.startswith("why ") or "what reason" in q:
        return "WHY"
    return "WHAT"


def _question_type_boost(q_type: str, sentences: list[str]) -> np.ndarray:
    """
    Return a 0-1 boost score per sentence based on whether the sentence
    contains the *kind* of information the question is asking for.
    """
    boosts = np.zeros(len(sentences))
    for i, s in enumerate(sentences):
        if q_type == "WHEN" and _DATE_PATTERN.search(s):
            boosts[i] = 1.0
        elif q_type == "WHO" and _PROPER_NOUN_PATTERN.search(s):
            boosts[i] = 1.0
        elif q_type == "WHERE" and _LOCATION_HINTS.search(s):
            boosts[i] = 1.0
        elif q_type == "HOW_MANY" and _NUMBER_PATTERN.search(s):
            boosts[i] = 1.0
        elif q_type == "WHY" and _REASON_HINTS.search(s):
            boosts[i] = 1.0
        # WHAT is generic — no special boost (handled by TF-IDF)
    return boosts


# ---------------------------------------------------------------------------
# Concept 3 & 4 are applied inside answer_question():
#   3. N-gram TF-IDF — ngram_range=(1,2) to capture bigrams
#   4. Paragraph Chunking — score overlapping 3-sentence windows
# ---------------------------------------------------------------------------




# --- Keep existing helper functions (_analyze_sentiment, etc.) unchanged below ---
# --- HUGGING FACE PIPELINES ---
_sentiment_pipe = None
_ner_pipe = None

def _analyze_sentiment(text: str) -> dict[str, Any]:
    global _sentiment_pipe
    if _sentiment_pipe is None:
        from transformers import pipeline
        # Fast, standard model for sentiment
        _sentiment_pipe = pipeline("sentiment-analysis", model="distilbert/distilbert-base-uncased-finetuned-sst-2-english")

    # NLP models have a 512 token limit. We truncate to ~1500 chars to be safe.
    safe_text = text[:1500]
    
    # Returns e.g. [{'label': 'POSITIVE', 'score': 0.99}]
    result = _sentiment_pipe(safe_text)[0] 
    
    polarity = 1.0 if result["label"] == "POSITIVE" else -1.0
    confidence = float(result["score"])
    
    return {
        "label": result["label"],
        "polarity": round(polarity * confidence, 4),
        "confidence": round(confidence, 4)
    }

def _extract_entities(text: str) -> list[dict[str, str]]:
    global _ner_pipe
    if _ner_pipe is None:
        from transformers import pipeline
        # aggregation_strategy="simple" merges multi-word entities (like "New York") into one
        _ner_pipe = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")

    safe_text = text[:1500]
    results = _ner_pipe(safe_text)
    
    entities = []
    for ent in results:
        entities.append({
            "text": ent["word"],
            "label": ent["entity_group"], # e.g., PER, ORG, LOC, MISC
            "confidence": round(float(ent["score"]), 4)
        })
    
    # Remove duplicates, keeping the highest confidence version
    unique_ents = {}
    for e in entities:
        if e["text"] not in unique_ents or e["confidence"] > unique_ents[e["text"]]["confidence"]:
            unique_ents[e["text"]] = e
            
    return list(unique_ents.values())


def _extract_keywords(text: str, limit: int = 8) -> list[str]:
    # (Keep your existing keyword extraction function here)
    tokens = [token.lower() for token in re.findall(r"[A-Za-z]{4,}", text)]
    stopwords = {"that", "with", "from", "this", "have", "were", "your", "about", "http", "https"}
    filtered = [token for token in tokens if token not in stopwords]
    ranked = Counter(filtered).most_common(limit)
    return [token for token, _ in ranked]


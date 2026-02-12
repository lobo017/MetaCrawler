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

def answer_question(text: str, question: str) -> dict[str, Any]:
    """
    Conceptual QA engine.

    Combines four NLP strategies to find the best answer *by meaning*, not
    just literal word overlap:
      1. Synonym Expansion  — widens the query vocabulary
      2. Question-Type Scoring — boosts sentences matching the intent
      3. N-gram TF-IDF (bigrams) — captures multi-word concepts
      4. Paragraph Chunking — scores 3-sentence windows for richer context
    """
    if not text or not question:
        return {"answer": "I need content to analyze first.", "confidence": 0.0}

    # ---- Sentence splitting (same robust regex as before) ----
    raw_sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s', text)
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 15]

    if not sentences:
        return {"answer": "Not enough meaningful content found.", "confidence": 0.0}

    # ---- Concept 4: Paragraph Chunking ----
    # Build overlapping 3-sentence windows so the model scores coherent
    # paragraphs, not isolated sentences.
    WINDOW = 3
    chunks: list[str] = []
    chunk_indices: list[tuple[int, int]] = []  # (start_idx, end_idx) into sentences
    for i in range(len(sentences)):
        end = min(i + WINDOW, len(sentences))
        chunk = " ".join(sentences[i:end])
        chunks.append(chunk)
        chunk_indices.append((i, end - 1))

    # ---- Concept 1: Synonym Expansion ----
    expanded_question = _expand_with_synonyms(question)

    # ---- Concept 3: N-gram TF-IDF (bigrams) ----
    try:
        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),   # unigrams + bigrams
            max_features=10000,
        )
        tfidf_matrix = vectorizer.fit_transform([expanded_question] + chunks)
        cosine_sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    except ValueError:
        cosine_sims = np.zeros(len(chunks))

    # ---- Concept 2: Question-Type Scoring ----
    q_type = _classify_question(question)
    # Compute per-sentence boosts, then max-pool into chunk-level boosts
    sent_boosts = _question_type_boost(q_type, sentences)
    chunk_type_boosts = np.array([
        float(np.max(sent_boosts[start : end + 1]))
        for start, end in chunk_indices
    ])

    # ---- Keyword overlap (retained as a safety net) ----
    stop_words = {"what", "where", "how", "who", "when", "why", "is", "the",
                  "a", "an", "are", "was", "were", "do", "does", "did", "can",
                  "could", "should", "would", "it", "its", "this", "that", "of",
                  "in", "on", "for", "to", "and", "or"}
    q_tokens = set(re.findall(r"\w+", question.lower())) - stop_words
    # Also include synonym-expanded tokens
    expanded_q_tokens = set(re.findall(r"\w+", expanded_question.lower())) - stop_words
    overlap_scores = np.zeros(len(chunks))
    for i, chunk in enumerate(chunks):
        c_tokens = set(re.findall(r"\w+", chunk.lower()))
        if expanded_q_tokens:
            overlap_scores[i] = len(expanded_q_tokens & c_tokens) / len(expanded_q_tokens)

    # ---- Blend all signals ----
    final_scores = (
        cosine_sims       * 0.45 +   # Concept 1+3: synonym-expanded bigram TF-IDF
        overlap_scores    * 0.25 +   # Safety-net keyword overlap
        chunk_type_boosts * 0.30     # Concept 2: question-type boost
    )

    best_idx = int(np.argmax(final_scores))
    best_score = float(final_scores[best_idx])

    if best_score < 0.05:
        return {
            "answer": "I read the content, but I couldn't find a specific answer to that.",
            "confidence": round(best_score, 2),
        }

    # ---- Build the answer from the winning chunk ----
    start_s, end_s = chunk_indices[best_idx]
    key_sentence = sentences[start_s]  # highlight the lead sentence
    context_parts = sentences[start_s : end_s + 1]
    # Bold the key sentence in the output
    full_answer = " ".join(
        f"**{s}**" if s == key_sentence else s for s in context_parts
    ).strip()

    return {
        "answer": full_answer,
        "confidence": round(best_score, 2),
        "method": "conceptual_qa_v2",
        "question_type": q_type,
    }

# --- Keep existing helper functions (_analyze_sentiment, etc.) unchanged below ---
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
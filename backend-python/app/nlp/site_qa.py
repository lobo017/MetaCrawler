"""Local retriever trained on crawled website data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.scrapers.site_crawler import DATA_DIR


class SiteKnowledgeBase:
    def __init__(self) -> None:
        self.site_url: str | None = None
        self.chunks: list[dict[str, str]] = []
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix = None

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
        cleaned = " ".join((text or "").split()).strip()
        if not cleaned:
            return []

        if chunk_size <= 0:
            chunk_size = 900
        if overlap < 0:
            overlap = 0
        if overlap >= chunk_size:
            overlap = max(chunk_size // 4, 1)

        chunks: list[str] = []
        step = chunk_size - overlap
        start = 0
        while start < len(cleaned):
            piece = cleaned[start : start + chunk_size].strip()
            if piece:
                chunks.append(piece)
            start += step
        return chunks

    def train_from_crawl(self, crawl_file: Path) -> dict[str, Any]:
        payload = json.loads(crawl_file.read_text(encoding="utf-8"))
        pages = payload.get("pages", [])

        chunks: list[dict[str, str]] = []
        for page in pages:
            page_chunks = page.get("chunks") or []
            if not page_chunks:
                page_chunks = self.chunk_text(page.get("text") or "")

            for chunk in page_chunks:
                clean_chunk = " ".join(str(chunk).split()).strip()
                if not clean_chunk:
                    continue
                chunks.append(
                    {
                        "url": page.get("url", ""),
                        "title": page.get("title", ""),
                        "text": clean_chunk,
                    }
                )

        if not chunks:
            self.site_url = payload.get("seed_url")
            self.chunks = []
            self.vectorizer = None
            self.matrix = None
            return {"site_url": self.site_url, "trained_chunks": 0}

        corpus = [item["text"] for item in chunks]
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=25000)
        matrix = vectorizer.fit_transform(corpus)

        self.site_url = payload.get("seed_url")
        self.chunks = chunks
        self.vectorizer = vectorizer
        self.matrix = matrix

        return {
            "site_url": self.site_url,
            "trained_chunks": len(chunks),
            "page_count": len(pages),
        }

    def query(self, question: str, top_k: int = 3) -> dict[str, Any]:
        if not question.strip():
            return {"answer": "Question cannot be empty.", "confidence": 0.0, "matches": []}

        if not self.vectorizer or self.matrix is None or not self.chunks:
            return {
                "answer": "No site model is trained yet. Call /site/crawl-and-train first.",
                "confidence": 0.0,
                "matches": [],
            }

        query_vector = self.vectorizer.transform([question])
        similarities = cosine_similarity(query_vector, self.matrix).flatten()

        if not np.any(similarities):
            return {
                "answer": "I could not find relevant content in the trained site corpus.",
                "confidence": 0.0,
                "matches": [],
                "site_url": self.site_url,
            }

        best_indices = similarities.argsort()[::-1][: max(top_k, 1)]
        matches = []
        for idx in best_indices:
            score = float(similarities[idx])
            item = self.chunks[int(idx)]
            matches.append(
                {
                    "url": item["url"],
                    "title": item["title"],
                    "snippet": item["text"],
                    "score": round(score, 4),
                }
            )

        best = matches[0]
        return {
            "site_url": self.site_url,
            "answer": best["snippet"],
            "confidence": best["score"],
            "matches": matches,
            "model": "local_tfidf_retriever",
        }


def latest_crawl_file_for_url(seed_url: str) -> Path | None:
    candidates = sorted(DATA_DIR.glob("site_*.json"), reverse=True)
    for candidate in candidates:
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
        if payload.get("seed_url") == seed_url:
            return candidate
    return None

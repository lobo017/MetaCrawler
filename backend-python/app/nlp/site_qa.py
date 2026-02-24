"""Local semantic retriever and LLM Generator trained on crawled website data."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

from app.scrapers.site_crawler import DATA_DIR

# Initialize ChromaDB persistent client
CHROMA_DIR = DATA_DIR / "chroma"
chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))

# Embedding model for Semantic Search
emb_fn = embedding_functions.DefaultEmbeddingFunction()

# --- LAZY LOADED GENERATIVE LLM ---
_llm_pipe = None

def _get_llm():
    global _llm_pipe
    if _llm_pipe is None:
        from transformers import pipeline
        import logging
        logging.getLogger("transformers").setLevel(logging.ERROR)
        
        # Load a highly efficient, CPU-friendly instruction model
        _llm_pipe = pipeline(
            "text-generation",
            model="Qwen/Qwen2.5-0.5B-Instruct",
            device="cpu"
        )
    return _llm_pipe

def _get_collection_name(url: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9_-]', '_', url)
    return clean.strip('_')[:63]

class SiteKnowledgeBase:
    def __init__(self, site_url: str) -> None:
        self.site_url = site_url
        self.collection_name = _get_collection_name(site_url)
        self.collection = chroma_client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=emb_fn
        )

    @staticmethod
    def chunk_text(text: str, max_words: int = 150, overlap: int = 30) -> list[str]:
        words = (text or "").split()
        if not words:
            return []

        if max_words <= 0:
            max_words = 150
        if overlap < 0:
            overlap = 0
        if overlap >= max_words:
            overlap = max(max_words // 4, 1)

        chunks: list[str] = []
        step = max_words - overlap
        start = 0
        while start < len(words):
            chunk_words = words[start : start + max_words]
            piece = " ".join(chunk_words).strip()
            if piece:
                chunks.append(piece)
            start += step
        return chunks

    def train_from_crawl(self, crawl_file: Path) -> dict[str, Any]:
        payload = json.loads(crawl_file.read_text(encoding="utf-8"))
        pages = payload.get("pages", [])

        docs = []
        metadatas = []
        ids = []

        chunk_id = 0
        for page in pages:
            page_chunks = page.get("chunks") or []
            if not page_chunks:
                page_chunks = self.chunk_text(page.get("text") or "")

            for chunk in page_chunks:
                clean_chunk = " ".join(str(chunk).split()).strip()
                if not clean_chunk:
                    continue
                docs.append(clean_chunk)
                metadatas.append({"url": page.get("url", ""), "title": page.get("title", "")})
                ids.append(f"chunk_{chunk_id}")
                chunk_id += 1

        if not docs:
            return {"site_url": self.site_url, "trained_chunks": 0, "page_count": len(pages)}

        batch_size = 1000
        for i in range(0, len(docs), batch_size):
            self.collection.upsert(
                documents=docs[i : i + batch_size],
                metadatas=metadatas[i : i + batch_size],
                ids=ids[i : i + batch_size]
            )

        return {
            "site_url": self.site_url,
            "trained_chunks": len(docs),
            "page_count": len(pages),
        }

    def query(self, question: str, top_k: int = 3, history: list[dict[str, str]] | None = None) -> dict[str, Any]:

        if history is None:
            history = []

        if not question.strip():
            return {"answer": "Question cannot be empty.", "confidence": 0.0, "matches": []}

        if self.collection.count() == 0:
            return {
                "answer": "No site model is trained yet. Call /site/crawl-and-train first.",
                "confidence": 0.0,
                "matches": [],
            }

        # 1. RETRIEVE: Find the best snippet in ChromaDB
        results = self.collection.query(
            query_texts=[question],
            n_results=max(top_k, 1)
        )

        if not results["documents"] or not results["documents"][0]:
            return {
                "answer": "I could not find relevant content in the trained site corpus.",
                "confidence": 0.0,
                "matches": [],
                "site_url": self.site_url,
            }

        matches = []
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        for i in range(len(docs)):
            score = max(0.0, 1.0 - (distances[i] / 2.0))
            matches.append({
                "url": metas[i].get("url", ""),
                "title": metas[i].get("title", ""),
                "snippet": docs[i],
                "score": round(score, 4),
            })

        best_snippet = matches[0]["snippet"]
        confidence_score = matches[0]["score"]

        messages = [
        {
            "role": "system", 
            "content": (
                "You are an expert data analyst. Your goal is maximum usefulness per word. "
                "Answer the user's question directly and accurately using ONLY the provided context. "
                "Follow these rules: "
                "1. If the context lacks the answer, state: 'I cannot answer this based on the scraped data.' "
                "2. Do not hallucinate or use outside knowledge. "
                "3. Use clear headings and bullet points if helpful. "
                "4. Be concise and avoid filler."
            )
        }
    ]
        # 2. GENERATE: Pass the snippet and question to the LLM
        generator = _get_llm()
        
        # Format the prompt using standard Chat ML format
        

        for msg in history[-4:]:
            role = "assistant" if msg.get("role") == "bot" else "user"
            messages.append({"role": role, "content": msg.get("text", "")})
            
        messages.append({
            "role": "user", 
            "content": f"Context:\n{best_snippet}\n\nQuestion:\n{question}"
        })
        
        prompt = generator.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        # Generate the answer (max_new_tokens controls how long the answer can be)
        outputs = generator(prompt, max_new_tokens=150, do_sample=False)
        
        # Strip out the prompt text to get just the model's answer
        generated_answer = outputs[0]["generated_text"][len(prompt):].strip()

        return {
            "site_url": self.site_url,
            "answer": generated_answer,
            "confidence": confidence_score,
            "snippet": best_snippet, # Keeping this so UI can show citations
            "matches": matches,
            "model": "qwen_2.5_rag",
        }
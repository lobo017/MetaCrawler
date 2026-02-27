"""FastAPI entry point for the MetaCrawler Python microservice."""

from __future__ import annotations

import os
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

# Import the new answer_question function
from app.nlp.processor import analyze_text, answer_question
from app.nlp.site_qa import SiteKnowledgeBase
from app.scrapers.basic_scraper import scrape_url
from app.scrapers.site_crawler import crawl_site, save_crawl
from celery_worker import celery_app, process_nlp_task, process_quick_scrape_task
from app.unified_rag import embed_text, get_stream_response


app = FastAPI(title="MetaCrawler Python Service", version="1.0.0")

class AnalyzePayload(BaseModel):
    text: str = Field(..., min_length=1)
    tasks: list[str] | None = None
    async_task: bool = False

class ScrapePayload(BaseModel):
    url: HttpUrl
    selector: str | None = None
    async_task: bool = False

# Payload for QA
class QAPayload(BaseModel):
    text: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    history: list[dict[str, str]] = []

class SiteTrainPayload(BaseModel):
    url: HttpUrl
    max_pages: int = Field(default=25, ge=1, le=200)
    max_depth: int = Field(default=2, ge=0, le=6)

class SiteQuestionPayload(BaseModel):
    url: HttpUrl
    question: str = Field(..., min_length=1)
    top_k: int = Field(default=3, ge=1, le=10)
    history: list[dict[str, str]] = []

class MultiChatPayload(BaseModel):
    question: str = Field(..., min_length=1)
    history: list[dict[str, str]] = []
    texts: list[str] = []
    urls: list[str] = []
    top_k: int = Field(default=3, ge=1, le=10)
    
class EmbedPayload(BaseModel):
    job_id: str
    text: str

class StreamPayload(BaseModel):
    question: str
    urls: list[str] = []
    job_ids: list[str] = []
    history: list[dict] = []


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "python-ml"}

@app.get("/health")
def extended_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "python-ml",
        "celery_broker": os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
        "celery_registered_tasks": sorted(celery_app.tasks.keys())[:5],
    }

@app.post("/analyze")
def analyze_content(payload: AnalyzePayload) -> dict[str, Any]:
    if payload.async_task:
        task = process_nlp_task.delay(payload.text, payload.tasks)
        return {"task_id": task.id, "status": "queued"}

    return analyze_text(payload.text, payload.tasks)

@app.post("/scrape/quick")
def quick_scrape(payload: ScrapePayload, background_tasks: BackgroundTasks) -> dict[str, Any]:
    url = str(payload.url)
    if payload.async_task:
        task = process_quick_scrape_task.delay(url, payload.selector)
        return {"task_id": task.id, "status": "queued"}

    if payload.selector:
        container: dict[str, Any] = {}

        def _run() -> None:
            container["result"] = scrape_url(url, payload.selector)

        background_tasks.add_task(_run)
        return {
            "status": "accepted",
            "message": "Scrape scheduled in background.",
            "url": url,
        }

    try:
        return scrape_url(url, payload.selector)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.post("/qa")
def qa_endpoint(payload: QAPayload) -> dict[str, Any]:
    return answer_question(payload.text, payload.question, payload.history)

@app.post("/site/crawl-and-train")
def crawl_and_train(payload: SiteTrainPayload) -> dict[str, Any]:
    crawl, engine = crawl_site(str(payload.url), max_pages=payload.max_pages, max_depth=payload.max_depth)
    crawl_file = save_crawl(str(payload.url), crawl, engine)
    
    # Instantiate KB with the URL, it automatically connects to the Chroma DB collection
    kb = SiteKnowledgeBase(str(payload.url))
    training = kb.train_from_crawl(crawl_file)
    
    return {
        "crawl_file": str(crawl_file),
        "blocked_count": len(crawl.blocked_urls),
        "failed_count": len(crawl.failed_urls),
        "engine": engine,
        "fallback_order": ["go", "python", "node"],
        "training": training,
    }


@app.post("/site/ask")
def ask_site(payload: SiteQuestionPayload) -> dict[str, Any]:
    kb = SiteKnowledgeBase(str(payload.url))
    if kb.collection.count() == 0:
        raise HTTPException(status_code=404, detail="No trained site model found for this URL.")
    try:
        return kb.query(payload.question, top_k=payload.top_k, history=payload.history)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to answer: {exc}") from exc

from app.nlp.processor import answer_multi_source

@app.post("/chat/ask")
def chat_ask_endpoint(payload: MultiChatPayload) -> dict[str, Any]:
    return answer_multi_source(
        question=payload.question, 
        texts=payload.texts, 
        urls=payload.urls, 
        history=payload.history,
        top_k=payload.top_k
    )

@app.post("/embed")
def embed_endpoint(payload: EmbedPayload):
    return embed_text(payload.job_id, payload.text)

@app.post("/stream/chat")
def stream_chat_endpoint(payload: StreamPayload):
    return get_stream_response(
        payload.question, 
        payload.urls, 
        payload.job_ids, 
        payload.history
    )
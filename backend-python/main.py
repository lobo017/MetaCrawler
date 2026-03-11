"""FastAPI entry point for the MetaCrawler Python microservice."""

from __future__ import annotations

import os
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.nlp.processor import analyze_text
from app.scrapers.basic_scraper import scrape_url
from celery_worker import celery_app, process_nlp_task, process_quick_scrape_task
from app.unified_rag import embed_text, get_stream_response
from celery.result import AsyncResult
import logging
import json
from datetime import datetime
import sys

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": "python-ml",
            "message": record.getMessage(),
        }
        if hasattr(record, "metadata"):
            log_obj.update(record.metadata)
        if record.exc_info:
            log_obj["error"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

logger = logging.getLogger("metacrawler")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)


app = FastAPI(title="MetaCrawler Python Service", version="1.0.0")

class AnalyzePayload(BaseModel):
    text: str = Field(..., min_length=1)
    tasks: list[str] | None = None
    async_task: bool = False

class ScrapePayload(BaseModel):
    url: HttpUrl
    selector: str | None = None
    async_task: bool = False


class SiteTrainPayload(BaseModel):
    url: HttpUrl
    max_pages: int = Field(default=25, ge=1, le=200)
    max_depth: int = Field(default=2, ge=0, le=6)
    job_id: str | None = None

class SiteQuestionPayload(BaseModel):
    url: HttpUrl
    question: str = Field(..., min_length=1)
    top_k: int = Field(default=3, ge=1, le=10)
    history: list[dict[str, str]] = []


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



@app.post("/site/crawl-and-train")
def crawl_and_train(payload: SiteTrainPayload) -> dict[str, Any]:
    """Dispatches a background Celery task. Returns task_id immediately."""
    from celery_worker import crawl_and_train_task
    logger.info("Dispatching Celery crawl-and-train", extra={"metadata": {"jobId": payload.job_id, "url": str(payload.url), "event": "worker_dispatched"}})
    task = crawl_and_train_task.delay(
        str(payload.url), payload.max_pages, payload.max_depth, payload.job_id
    )
    return {"task_id": task.id, "status": "queued"}


@app.get("/tasks/{task_id}")
def get_task_status(task_id: str) -> dict[str, Any]:
    """Poll the status of any Celery task by its ID."""
    result = AsyncResult(task_id)
    if result.state == "PENDING":
        return {"status": "pending", "result": None}
    if result.state == "SUCCESS":
        return {"status": "success", "result": result.result}
    if result.state == "FAILURE":
        return {"status": "failure", "result": str(result.info)}
    # STARTED, RETRY, etc.
    return {"status": result.state.lower(), "result": None}


@app.post("/site/ask")
def ask_site(payload: SiteQuestionPayload) -> dict[str, Any]:
    from app.nlp.site_qa import SiteKnowledgeBase
    kb = SiteKnowledgeBase(str(payload.url))
    if kb.collection.count() == 0:
        raise HTTPException(status_code=404, detail="No trained site model found for this URL.")
    try:
        return kb.query(payload.question, top_k=payload.top_k, history=payload.history)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to answer: {exc}") from exc



@app.post("/embed")
def embed_endpoint(payload: EmbedPayload):
    return embed_text(payload.job_id, payload.text)

@app.post("/stream/chat")
def stream_chat_endpoint(payload: StreamPayload):
    # No extra StreamingResponse wrapper here!
    return get_stream_response(
        payload.question, 
        payload.urls, 
        payload.job_ids, 
        payload.history
    )
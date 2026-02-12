"""FastAPI entry point for the MetaCrawler Python microservice."""

from __future__ import annotations

import os
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

# Import the new answer_question function
from app.nlp.processor import analyze_text, answer_question
from app.scrapers.basic_scraper import scrape_url
from celery_worker import celery_app, process_nlp_task, process_quick_scrape_task

app = FastAPI(title="MetaCrawler Python Service", version="1.0.0")

class AnalyzePayload(BaseModel):
    text: str = Field(..., min_length=1)
    tasks: list[str] | None = None
    async_task: bool = False

class ScrapePayload(BaseModel):
    url: HttpUrl
    selector: str | None = None
    async_task: bool = False

# New Payload for QA
class QAPayload(BaseModel):
    text: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)

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

# New Endpoint
@app.post("/qa")
def qa_endpoint(payload: QAPayload) -> dict[str, Any]:
    return answer_question(payload.text, payload.question)
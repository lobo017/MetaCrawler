"""Celery worker configuration and async task definitions."""

from __future__ import annotations

import os

from celery import Celery

from app.nlp.processor import analyze_text
from app.scrapers.basic_scraper import scrape_url

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

celery_app = Celery("metacrawler_worker", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)


@celery_app.task(name="tasks.process_nlp")
def process_nlp_task(text: str, tasks: list[str] | None = None) -> dict:
    return analyze_text(text, tasks)


@celery_app.task(name="tasks.process_quick_scrape")
def process_quick_scrape_task(url: str, selector: str | None = None) -> dict:
    return scrape_url(url, selector)

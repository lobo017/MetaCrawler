"""Celery worker configuration and async task definitions."""

from __future__ import annotations

import os
import requests

from celery import Celery

from app.nlp.processor import analyze_text
from app.scrapers.basic_scraper import scrape_url
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

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
# Clear out celery's default handlers if needed, or just append
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)

GATEWAY_WEBHOOK_URL = os.getenv("GATEWAY_WEBHOOK_URL", "http://gateway:4000/webhook/celery")

def notify_webhook(job_id: str, status: str, result: dict | str = None, error: str = None, metadata: dict = None) -> None:
    """Dispatches an idempotent background status update to the API Gateway."""
    if not job_id:
        return
    payload = {"jobId": job_id, "status": status, "result": result, "error": error, "metadata": metadata}
    try:
        logger.info(f"Delivering webhook", extra={"metadata": {"jobId": job_id, "event": "webhook_delivery", "status": status}})
        requests.post(GATEWAY_WEBHOOK_URL, json=payload, timeout=5)
    except Exception as e:
        logger.error(f"Webhook Failure", extra={"metadata": {"jobId": job_id, "status": status, "error": str(e)}})

CELERY_BROKER_URL     = os.getenv("CELERY_BROKER_URL",     "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

celery_app = Celery("metacrawler_worker", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)

# ── Global Celery configuration ──────────────────────────────────────────────
celery_app.conf.update(
    # Results expire after 1 hour — prevents Redis bloat
    result_expires=3600,

    # Route tasks to dedicated queues so NLP and scrapes don't starve each other
    task_routes={
        "tasks.process_nlp":          {"queue": "nlp"},
        "tasks.process_quick_scrape": {"queue": "scrape"},
        "tasks.crawl_and_train":      {"queue": "nlp"},   # CPU-heavy, same pool as NLP
    },

    # Hard-kill any task after 5 minutes; warn at 4 minutes
    task_time_limit=300,
    task_soft_time_limit=240,

    # Re-queue tasks if a worker crashes mid-execution
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # JSON-only serialization — never use pickle
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)


@celery_app.task(
    name="tasks.process_nlp",
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    soft_time_limit=240,
    time_limit=300,
)
def process_nlp_task(self, text: str, tasks: list[str] | None = None) -> dict:
    try:
        return analyze_text(text, tasks)
    except Exception as exc:
        logger.warning(f"NLP task failed (attempt {self.request.retries + 1}): {exc}")
        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))


@celery_app.task(
    name="tasks.process_quick_scrape",
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    soft_time_limit=120,
    time_limit=150,
)
def process_quick_scrape_task(self, url: str, selector: str | None = None) -> dict:
    try:
        return scrape_url(url, selector)
    except Exception as exc:
        logger.warning(f"Scrape task failed for {url} (attempt {self.request.retries + 1}): {exc}")
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))


@celery_app.task(
    name="tasks.crawl_and_train",
    bind=True,
    max_retries=1,
    default_retry_delay=30,
    # Crawling 25 pages + embedding can take several minutes.
    # Soft limit warns at 9 min; hard kill at 10 min.
    soft_time_limit=540,
    time_limit=600,
)
def crawl_and_train_task(self, url: str, max_pages: int = 25, max_depth: int = 2, job_id: str | None = None) -> dict:
    """Crawl a site and embed all pages into ChromaDB. Run as an async Celery task."""
    notify_webhook(job_id, "running", metadata={"task_id": self.request.id})

    try:
        from app.scrapers.site_crawler import crawl_site, save_crawl
        from app.nlp.site_qa import SiteKnowledgeBase

        crawl, engine = crawl_site(url, max_pages=max_pages, max_depth=max_depth)
        crawl_file = save_crawl(url, crawl, engine)

        kb = SiteKnowledgeBase(url)
        training = kb.train_from_crawl(crawl_file)

        result_dict = {
            "crawl_file": str(crawl_file),
            "blocked_count": len(crawl.blocked_urls),
            "failed_count": len(crawl.failed_urls),
            "engine": engine,
            "fallback_order": ["go", "python", "node"],
            "training": training,
        }
        
        notify_webhook(job_id, "done", result=result_dict)
        return result_dict

    except Exception as exc:
        is_terminal = self.request.retries >= self.max_retries
        if is_terminal:
            notify_webhook(job_id, "failed", error=str(exc))
        
        logger.error(f"crawl_and_train_task failed for {url}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)

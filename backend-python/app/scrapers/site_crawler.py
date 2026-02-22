"""Website crawler that respects robots.txt and builds a local corpus."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import re
from typing import Any
from urllib.parse import urljoin, urlparse
import urllib.robotparser

import requests
from bs4 import BeautifulSoup

USER_AGENT = "MetaCrawler/1.0 (Educational)"
DEFAULT_TIMEOUT_SECONDS = 15
DEFAULT_MAX_PAGES = 25
DEFAULT_MAX_DEPTH = 2
MAX_CHUNK_WORDS = 160

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)


@dataclass
class CrawlResult:
    pages: list[dict[str, Any]]
    blocked_urls: list[str]
    failed_urls: list[dict[str, str]]


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _domain_from_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc.lower()


def _safe_filename(seed_url: str) -> str:
    digest = hashlib.sha1(seed_url.encode("utf-8")).hexdigest()[:16]
    return f"site_{digest}.json"


def _extract_clean_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form", "iframe", "svg"]):
        tag.decompose()
    return _normalize_whitespace(soup.get_text(separator=" ", strip=True))


def _split_into_chunks(text: str, max_words: int = MAX_CHUNK_WORDS) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks = []
    for i in range(0, len(words), max_words):
        chunk = " ".join(words[i : i + max_words]).strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _build_robot_parser(start_url: str) -> urllib.robotparser.RobotFileParser:
    parsed = urlparse(start_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        pass
    return parser


def _normalize_pages(pages):
    if not pages:
        return []
    normalized = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        normalized.append({
            "url": page.get("url") or page.get("link") or "",
            "title": page.get("title") or "",
            "text": page.get("text") or page.get("content") or "",
        })
    return [p for p in normalized if p["url"] and p["text"]]


def crawl_site_go(seed_url: str, max_pages: int = DEFAULT_MAX_PAGES, max_depth: int = DEFAULT_MAX_DEPTH) -> CrawlResult:
    go_service = os.getenv("GO_SERVICE_URL", "http://go:8080")
    response = requests.post(
        f"{go_service}/crawl",
        json={"url": seed_url, "max_pages": max_pages, "max_depth": max_depth},
        timeout=DEFAULT_TIMEOUT_SECONDS * 4,
    )
    response.raise_for_status()
    payload = response.json()

    pages = _normalize_pages(payload.get("pages") or [])
    blocked = payload.get("blockedUrls") or []
    failed_urls = payload.get("failedUrls") or []
    failed = [{"url": url, "error": "go_crawler_failed"} for url in failed_urls]
    if payload.get("pages") is None:
        # keep debugging visibility
        failed.append({"url": seed_url, "error": f"go returned pages=null; keys={list(payload.keys())}"})
    return CrawlResult(pages=pages, blocked_urls=blocked, failed_urls=failed)


def crawl_site_python(seed_url: str, max_pages: int = DEFAULT_MAX_PAGES, max_depth: int = DEFAULT_MAX_DEPTH) -> CrawlResult:
    robot_parser = _build_robot_parser(seed_url)
    root_domain = _domain_from_url(seed_url)

    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])
    visited: set[str] = set()
    pages: list[dict[str, Any]] = []
    blocked_urls: list[str] = []
    failed_urls: list[dict[str, str]] = []

    while queue and len(pages) < max_pages:
        current_url, depth = queue.popleft()
        if current_url in visited:
            continue
        visited.add(current_url)

        if not robot_parser.can_fetch(USER_AGENT, current_url):
            blocked_urls.append(current_url)
            continue

        try:
            response = requests.get(
                current_url,
                timeout=DEFAULT_TIMEOUT_SECONDS,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            failed_urls.append({"url": current_url, "error": str(exc)})
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        page_text = _extract_clean_text(soup)
        if not page_text:
            continue

        title = _normalize_whitespace(soup.title.text) if soup.title else ""
        page_chunks = _split_into_chunks(page_text)

        pages.append({"url": current_url, "title": title, "text": page_text, "chunks": page_chunks})

        if depth >= max_depth:
            continue

        for anchor in soup.find_all("a", href=True):
            next_url = urljoin(current_url, anchor["href"])
            parsed = urlparse(next_url)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc.lower() != root_domain:
                continue
            normalized = parsed._replace(fragment="", query="").geturl()
            if normalized not in visited:
                queue.append((normalized, depth + 1))

    return CrawlResult(pages=pages, blocked_urls=blocked_urls, failed_urls=failed_urls)


def crawl_site_node(seed_url: str, max_pages: int = DEFAULT_MAX_PAGES, max_depth: int = DEFAULT_MAX_DEPTH) -> CrawlResult:
    node_service = os.getenv("NODE_SERVICE_URL", "http://node:3000")
    robot_parser = _build_robot_parser(seed_url)
    root_domain = _domain_from_url(seed_url)

    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])
    visited: set[str] = set()
    pages: list[dict[str, Any]] = []
    blocked_urls: list[str] = []
    failed_urls: list[dict[str, str]] = []

    while queue and len(pages) < max_pages:
        current_url, depth = queue.popleft()
        if current_url in visited:
            continue
        visited.add(current_url)

        if not robot_parser.can_fetch(USER_AGENT, current_url):
            blocked_urls.append(current_url)
            continue

        try:
            response = requests.post(
                f"{node_service}/scrape",
                json={"url": current_url},
                timeout=DEFAULT_TIMEOUT_SECONDS * 4,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            failed_urls.append({"url": current_url, "error": str(exc)})
            continue

        raw_content = payload.get("content", [])
        if isinstance(raw_content, list):
            text_blob = " ".join(str(item) for item in raw_content)
        else:
            text_blob = str(raw_content)

        page_text = _normalize_whitespace(text_blob)
        if not page_text:
            continue

        title = _normalize_whitespace(payload.get("title", ""))
        pages.append({
            "url": current_url,
            "title": title,
            "text": page_text,
            "chunks": _split_into_chunks(page_text),
        })

        if depth >= max_depth:
            continue

        # Use lightweight HTML fetch for link discovery only.
        try:
            html_response = requests.get(current_url, timeout=DEFAULT_TIMEOUT_SECONDS, headers={"User-Agent": USER_AGENT})
            html_response.raise_for_status()
            soup = BeautifulSoup(html_response.text, "html.parser")
        except requests.RequestException:
            continue

        for anchor in soup.find_all("a", href=True):
            next_url = urljoin(current_url, anchor["href"])
            parsed = urlparse(next_url)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc.lower() != root_domain:
                continue
            normalized = parsed._replace(fragment="", query="").geturl()
            if normalized not in visited:
                queue.append((normalized, depth + 1))

    return CrawlResult(pages=pages, blocked_urls=blocked_urls, failed_urls=failed_urls)


def crawl_site(seed_url: str, max_pages: int = DEFAULT_MAX_PAGES, max_depth: int = DEFAULT_MAX_DEPTH) -> tuple[CrawlResult, str]:
    go_result: CrawlResult | None = None
    try:
        go_result = crawl_site_go(seed_url, max_pages=max_pages, max_depth=max_depth)
    except Exception as exc:
        logger.warning("Go crawler failed for %s: %s", seed_url, exc)

    if go_result is not None and go_result.pages:
        return go_result, "go"

    python_result = crawl_site_python(seed_url, max_pages=max_pages, max_depth=max_depth)
    if python_result.pages:
        return python_result, "python_fallback"

    node_result = crawl_site_node(seed_url, max_pages=max_pages, max_depth=max_depth)
    return node_result, "node_fallback"


def save_crawl(seed_url: str, crawl: CrawlResult, engine: str) -> Path:
    payload = {
        "seed_url": seed_url,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "engine": engine,
        "page_count": len(crawl.pages),
        "pages": crawl.pages,
        "blocked_urls": crawl.blocked_urls,
        "failed_urls": crawl.failed_urls,
    }
    filename = _safe_filename(seed_url)
    target = DATA_DIR / filename
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return target

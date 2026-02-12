"""Simple HTTP scraper for static HTML pages."""

from __future__ import annotations

import re
from typing import Any

import requests
from bs4 import BeautifulSoup

DEFAULT_TIMEOUT_SECONDS = 15


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def scrape_url(url: str, selector: str | None = None) -> dict[str, Any]:
    response = requests.get(
        url,
        timeout=DEFAULT_TIMEOUT_SECONDS,
        headers={"User-Agent": "MetaCrawler/1.0"},
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    page_title = _normalize_whitespace(soup.title.text) if soup.title else ""

    if selector:
        selected_nodes = soup.select(selector)
        selected_text = [_normalize_whitespace(node.get_text(" ")) for node in selected_nodes]
        return {
            "url": url,
            "status_code": response.status_code,
            "title": page_title,
            "selector": selector,
            "matches": [item for item in selected_text if item],
            "match_count": len(selected_nodes),
        }

    body = soup.body.get_text(" ") if soup.body else soup.get_text(" ")
    metadata = {
        "description": "",
        "keywords": "",
    }
    description = soup.find("meta", attrs={"name": "description"})
    keywords = soup.find("meta", attrs={"name": "keywords"})
    if description and description.get("content"):
        metadata["description"] = _normalize_whitespace(description["content"])
    if keywords and keywords.get("content"):
        metadata["keywords"] = _normalize_whitespace(keywords["content"])

    return {
        "url": url,
        "status_code": response.status_code,
        "title": page_title,
        "text": _normalize_whitespace(body),
        "metadata": metadata,
    }

"""Simple HTTP scraper for static HTML pages with robots.txt compliance."""

from __future__ import annotations

import re
import urllib.robotparser
from urllib.parse import urlparse
from typing import Any

import requests
from bs4 import BeautifulSoup

DEFAULT_TIMEOUT_SECONDS = 15
USER_AGENT = "MetaCrawler/1.0 (Educational)"

def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()

def can_fetch(url: str, user_agent: str = USER_AGENT) -> bool:
    """Checks the site's robots.txt to see if we are allowed to scrape."""
    try:
        parsed_url = urlparse(url)
        robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
        
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        
        return rp.can_fetch(user_agent, url)
    except Exception:
        # If robots.txt is unreachable or malformed, standard practice is to assume ALLOW
        # purely for resilience, though strict bots might default to DENY.
        return True

def scrape_url(url: str, selector: str | None = None) -> dict[str, Any]:
    # 1. Check Robots.txt first
    if not can_fetch(url):
        return {
            "error": "Access denied by robots.txt",
            "url": url,
            "status_code": 403
        }

    try:
        response = requests.get(
            url,
            timeout=DEFAULT_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
    except requests.RequestException as e:
        return {"error": str(e), "url": url}

    soup = BeautifulSoup(response.text, "html.parser")
    
    # 2. Remove Noise (Scripts, Styles, etc)
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form", "iframe", "svg"]):
        tag.decompose()

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

    # Use separator to keep sentences distinct
    body = soup.get_text(separator=". ", strip=True)
    
    metadata = {"description": "", "keywords": ""}
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
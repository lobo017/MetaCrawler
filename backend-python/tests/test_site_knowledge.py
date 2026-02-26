import pytest
from fastapi import HTTPException

import main
from app.scrapers.site_crawler import CrawlResult

# FIX: Removed the failing clean_site_kbs fixture here

def test_site_train_then_ask_happy_path(monkeypatch):
    def fake_crawl_site(url: str, max_pages: int = 25, max_depth: int = 2):
        return (
            CrawlResult(
                pages=[
                    {
                        "url": "https://example.com",
                        "title": "Example",
                        "text": "Example domain provides documentation and sample content.",
                        "chunks": ["Example domain provides documentation and sample content."],
                    }
                ],
                blocked_urls=[],
                failed_urls=[],
            ),
            "go",
        )

    monkeypatch.setattr(main, "crawl_site", fake_crawl_site)

    train_res = main.crawl_and_train(main.SiteTrainPayload(url="https://example.com", max_pages=5, max_depth=1))
    assert train_res["training"]["trained_chunks"] > 0

    ask_res = main.ask_site(main.SiteQuestionPayload(url="https://example.com", question="What does the site provide?", top_k=3))
    assert ask_res["answer"]
    assert ask_res["confidence"] >= 0


def test_site_ask_without_training_returns_error():
    with pytest.raises(HTTPException) as exc_info:
        main.ask_site(main.SiteQuestionPayload(url="https://missing.example", question="Any content?", top_k=3))

    assert exc_info.value.status_code == 404
    assert "No trained site model" in exc_info.value.detail
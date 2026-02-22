import pytest
from fastapi.testclient import TestClient

import main
from app.scrapers import site_crawler
from app.scrapers.site_crawler import CrawlResult


@pytest.fixture(autouse=True)
def clean_site_kbs():
    main.site_kbs.clear()
    main.site_kb = main.SiteKnowledgeBase()
    yield
    main.site_kbs.clear()
    main.site_kb = main.SiteKnowledgeBase()


def test_crawl_site_go_handles_null_list_fields(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"pages": None, "failedUrls": None, "blockedUrls": None}

    monkeypatch.setattr(site_crawler.requests, "post", lambda *args, **kwargs: FakeResponse())

    result = site_crawler.crawl_site_go("https://example.com", max_pages=5, max_depth=1)

    assert result.pages == []
    assert result.blocked_urls == []
    assert isinstance(result.failed_urls, list)


def test_crawl_and_train_falls_back_when_go_throws(monkeypatch):
    def fake_go(*args, **kwargs):
        raise RuntimeError("go unavailable")

    def fake_python(*args, **kwargs):
        return CrawlResult(
            pages=[
                {
                    "url": "https://example.com",
                    "title": "Example",
                    "text": "Example fallback content",
                    "chunks": ["Example fallback content"],
                }
            ],
            blocked_urls=[],
            failed_urls=[],
        )

    monkeypatch.setattr(site_crawler, "crawl_site_go", fake_go)
    monkeypatch.setattr(site_crawler, "crawl_site_python", fake_python)

    response = main.crawl_and_train(main.SiteTrainPayload(url="https://example.com", max_pages=5, max_depth=1))

    assert response["engine"] == "python_fallback"
    assert response["training"]["trained_chunks"] > 0

from fastapi.testclient import TestClient

import main
from app.scrapers.site_crawler import CrawlResult


client = TestClient(main.app)


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

    train_res = client.post(
        "/site/crawl-and-train",
        json={"url": "https://example.com", "max_pages": 5, "max_depth": 1},
    )
    assert train_res.status_code == 200
    assert train_res.json()["training"]["trained_chunks"] > 0

    ask_res = client.post(
        "/site/ask",
        json={"url": "https://example.com", "question": "What does the site provide?", "top_k": 3},
    )
    assert ask_res.status_code == 200
    body = ask_res.json()
    assert body["answer"]
    assert body["confidence"] >= 0


def test_site_ask_without_training_returns_error(tmp_path):
    missing_url = "https://missing.example"
    res = client.post(
        "/site/ask",
        json={"url": missing_url, "question": "Any content?", "top_k": 3},
    )
    assert res.status_code == 404
    assert "No trained site model" in res.json()["detail"]

import json

import main
from app.nlp.site_qa import SiteKnowledgeBase


def test_train_from_go_shaped_crawl_without_chunks(tmp_path):
    long_text = " ".join(["MetaCrawler extracts useful content for search and QA."] * 80)
    crawl_file = tmp_path / "site_go_shape.json"
    crawl_file.write_text(
        json.dumps(
            {
                "seed_url": "https://example.com",
                "pages": [
                    {
                        "url": "https://example.com/docs",
                        "title": "Docs",
                        "text": long_text,
                    }
                ],
                "blocked_urls": [],
                "failed_urls": [],
            }
        ),
        encoding="utf-8",
    )

    # FIX: Pass the required site_url argument
    url = "https://example.com"
    kb = SiteKnowledgeBase(url)
    training = kb.train_from_crawl(crawl_file)

    assert training["trained_chunks"] > 0

    # FIX: Removed the outdated main.site_kbs dictionary assignments. 
    # Because ChromaDB is persistent, main.ask_site will inherently 
    # read from the collection that kb.train_from_crawl() just wrote to.

    answer = main.ask_site(main.SiteQuestionPayload(url=url, question="What does MetaCrawler do?", top_k=3))
    assert answer["matches"] or answer["confidence"] > 0
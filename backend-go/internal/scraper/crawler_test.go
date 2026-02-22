package scraper

import "testing"

func TestEnsureNonNilSlices(t *testing.T) {
	res := &CrawlResult{}

	ensureNonNilSlices(res)

	if res.Pages == nil {
		t.Fatal("expected pages to be non-nil")
	}
	if res.BlockedURLs == nil {
		t.Fatal("expected blocked URLs to be non-nil")
	}
	if res.FailedURLs == nil {
		t.Fatal("expected failed URLs to be non-nil")
	}
}

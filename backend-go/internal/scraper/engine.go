package scraper

import (
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type ScrapeResult struct {
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Text      string   `json:"text"`
	Links     []string `json:"links"`
	WordCount int      `json:"wordCount"`
}

var (
	titleRegex = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	linkRegex  = regexp.MustCompile(`(?is)<a[^>]+href=["']([^"']+)["']`)
	tagRegex   = regexp.MustCompile(`(?is)<[^>]+>`)
	spaceRegex = regexp.MustCompile(`\s+`)
)

func Scrape(url string) (*ScrapeResult, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, err
	}

	html := string(body)
	title := ""
	if matches := titleRegex.FindStringSubmatch(html); len(matches) > 1 {
		title = normalize(matches[1])
	}

	text := normalize(tagRegex.ReplaceAllString(html, " "))
	links := make([]string, 0, 20)
	for _, match := range linkRegex.FindAllStringSubmatch(html, 20) {
		if len(match) > 1 {
			links = append(links, strings.TrimSpace(match[1]))
		}
	}

	return &ScrapeResult{
		URL:       url,
		Title:     title,
		Text:      text,
		Links:     links,
		WordCount: len(strings.Fields(text)),
	}, nil
}

func normalize(value string) string {
	return strings.TrimSpace(spaceRegex.ReplaceAllString(value, " "))
}

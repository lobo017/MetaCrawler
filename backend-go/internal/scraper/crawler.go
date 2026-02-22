package scraper

import (
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

type CrawlPage struct {
	URL   string `json:"url"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

type CrawlResult struct {
	SeedURL     string      `json:"seedUrl"`
	PageCount   int         `json:"pageCount"`
	Pages       []CrawlPage `json:"pages"`
	BlockedURLs []string    `json:"blockedUrls"`
	FailedURLs  []string    `json:"failedUrls"`
}

type CrawlOptions struct {
	MaxPages int
	MaxDepth int
	Workers  int
}

var robotDisallowRegex = regexp.MustCompile(`(?im)^disallow:\s*(\S*)`)

func Crawl(seed string, options CrawlOptions) *CrawlResult {
	if options.MaxPages <= 0 {
		options.MaxPages = 25
	}
	if options.MaxDepth < 0 {
		options.MaxDepth = 2
	}
	if options.Workers <= 0 {
		options.Workers = 6
	}

	res := &CrawlResult{
		SeedURL:     seed,
		Pages:       []CrawlPage{},
		BlockedURLs: []string{},
		FailedURLs:  []string{},
	}
	seedURL, err := url.Parse(seed)
	if err != nil {
		res.FailedURLs = append(res.FailedURLs, seed)
		return res
	}
	rules := fetchRobotsRules(seedURL)
	visited := map[string]struct{}{seed: {}}
	current := []string{seed}

	for depth := 0; depth <= options.MaxDepth && len(current) > 0 && len(res.Pages) < options.MaxPages; depth++ {
		nextLevel := make([]string, 0, options.MaxPages)
		sem := make(chan struct{}, options.Workers)
		var wg sync.WaitGroup
		var mu sync.Mutex

		for _, pageURL := range current {
			if len(res.Pages) >= options.MaxPages {
				break
			}
			wg.Add(1)
			sem <- struct{}{}
			go func(u string) {
				defer wg.Done()
				defer func() { <-sem }()

				if !isAllowedByRobots(seedURL, rules, u) {
					mu.Lock()
					res.BlockedURLs = append(res.BlockedURLs, u)
					mu.Unlock()
					return
				}

				page, links, ok := fetchPage(u)
				if !ok {
					mu.Lock()
					res.FailedURLs = append(res.FailedURLs, u)
					mu.Unlock()
					return
				}

				mu.Lock()
				if len(res.Pages) < options.MaxPages {
					res.Pages = append(res.Pages, page)
				}
				for _, href := range links {
					next := resolveAndNormalize(u, href)
					if next == "" || !sameHost(seedURL, next) {
						continue
					}
					if _, seen := visited[next]; seen {
						continue
					}
					visited[next] = struct{}{}
					nextLevel = append(nextLevel, next)
				}
				mu.Unlock()
			}(pageURL)
		}
		wg.Wait()
		current = nextLevel
	}

	res.PageCount = len(res.Pages)
	ensureNonNilSlices(res)
	return res
}

func ensureNonNilSlices(res *CrawlResult) {
	if res.Pages == nil {
		res.Pages = []CrawlPage{}
	}
	if res.BlockedURLs == nil {
		res.BlockedURLs = []string{}
	}
	if res.FailedURLs == nil {
		res.FailedURLs = []string{}
	}
}

func fetchPage(pageURL string) (CrawlPage, []string, bool) {
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(pageURL)
	if err != nil || resp.StatusCode >= 400 {
		return CrawlPage{}, nil, false
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return CrawlPage{}, nil, false
	}
	html := string(body)
	title := ""
	if matches := titleRegex.FindStringSubmatch(html); len(matches) > 1 {
		title = normalize(matches[1])
	}
	text := normalize(tagRegex.ReplaceAllString(html, " "))
	links := make([]string, 0, 50)
	for _, match := range linkRegex.FindAllStringSubmatch(html, 50) {
		if len(match) > 1 {
			links = append(links, strings.TrimSpace(match[1]))
		}
	}
	return CrawlPage{URL: pageURL, Title: title, Text: text}, links, true
}

func resolveAndNormalize(base string, href string) string {
	u, err := url.Parse(href)
	if err != nil {
		return ""
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return ""
	}
	resolved := baseURL.ResolveReference(u)
	resolved.Fragment = ""
	resolved.RawQuery = ""
	if resolved.Scheme != "http" && resolved.Scheme != "https" {
		return ""
	}
	return resolved.String()
}

func sameHost(seed *url.URL, candidate string) bool {
	u, err := url.Parse(candidate)
	if err != nil {
		return false
	}
	return strings.EqualFold(seed.Hostname(), u.Hostname())
}

func fetchRobotsRules(seed *url.URL) []string {
	robotsURL := seed.Scheme + "://" + seed.Host + "/robots.txt"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(robotsURL)
	if err != nil || resp.StatusCode >= 400 {
		return nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 200*1024))
	if err != nil {
		return nil
	}
	matches := robotDisallowRegex.FindAllStringSubmatch(string(body), -1)
	rules := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			r := strings.TrimSpace(m[1])
			if r != "" {
				rules = append(rules, r)
			}
		}
	}
	return rules
}

func isAllowedByRobots(seed *url.URL, rules []string, pageURL string) bool {
	if len(rules) == 0 {
		return true
	}
	u, err := url.Parse(pageURL)
	if err != nil {
		return false
	}
	if !strings.EqualFold(seed.Hostname(), u.Hostname()) {
		return false
	}
	path := u.EscapedPath()
	for _, disallow := range rules {
		if disallow == "/" || strings.HasPrefix(path, disallow) {
			return false
		}
	}
	return true
}

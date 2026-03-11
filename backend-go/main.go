package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"backend-go/internal/scraper" // Assumes module name is backend-go
)

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Service   string `json:"service"`
	Message   string `json:"message"`
	URL       string `json:"url,omitempty"`
	Event     string `json:"event,omitempty"`
	Status    string `json:"status,omitempty"`
	Error     string `json:"error,omitempty"`
}

func logInfo(msg string, url string, event string, status string) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     "info",
		Service:   "go-scraper",
		Message:   msg,
		URL:       url,
		Event:     event,
		Status:    status,
	}
	b, _ := json.Marshal(entry)
	fmt.Println(string(b))
}

func logError(msg string, url string, err string) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     "error",
		Service:   "go-scraper",
		Message:   msg,
		URL:       url,
		Event:     "status_changed",
		Status:    "failed",
		Error:     err,
	}
	b, _ := json.Marshal(entry)
	fmt.Println(string(b))
}

type ScrapeRequest struct {
	URL string `json:"url"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok","service":"go-scraper"}`))
}

func scrapeHandler(w http.ResponseWriter, r *http.Request) {
	var req ScrapeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logError("Invalid JSON", "", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	logInfo("Starting static scrape", req.URL, "worker_dispatched", "")
	res := scraper.Crawl(req.URL, scraper.CrawlOptions{MaxPages: 1, MaxDepth: 0})
	
	if len(res.FailedURLs) > 0 && res.FailedURLs[0] == req.URL {
		logError("Go Scraper Error", req.URL, "Failed to connect to seed URL")
		http.Error(w, "Failed to scrape", http.StatusInternalServerError)
		return
	}

	logInfo("Completed static scrape", req.URL, "status_changed", "done")
	w.Header().Set("Content-Type", "application/json")
	
	// Convert Crawler Single Page Array into root text payload expected by Gateway AI routing
	finalRes := struct {
		Text string `json:"text"`
	}{}
	if len(res.Pages) > 0 {
		finalRes.Text = res.Pages[0].Text
	}
	json.NewEncoder(w).Encode(finalRes)
}

func main() {
	http.HandleFunc("/", healthHandler) // backwards compat
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/scrape", scrapeHandler)
	
	fmt.Println("🚀 Go Scraper Server listening on :8080")
	http.ListenAndServe(":8080", nil)
}

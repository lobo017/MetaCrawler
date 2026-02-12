package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/lobo017/MetaCrawler/backend-go/internal/scraper"
)

type scrapeRequest struct {
	URL string `json:"url"`
}

func main() {
	http.HandleFunc("/", healthCheck)
	http.HandleFunc("/health", healthCheck)
	http.HandleFunc("/scrape", submitScrapeJob)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go Service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("go service failed: %v", err)
	}
}

func healthCheck(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "go-scraper"})
}

func submitScrapeJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req scrapeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URL == "" {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	result, err := scraper.Scrape(req.URL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

# MetaCrawler

MetaCrawler is a full-stack AI-powered web scraping platform that combines Python, Go, and Node.js microservices behind a unified API gateway and a Next.js dashboard.

## Architecture

- **frontend** (`Next.js`): dashboard for creating jobs and tracking stats/results.
- **api-gateway** (`Node.js`): single entry point exposing `/graphql`, `/jobs`, and `/stats`.
- **backend-python** (`FastAPI` + `Celery hooks`): static scraping and NLP enrichment.
- **backend-go** (`net/http`): fast static page scraping endpoint.
- **backend-node** (`Express`): dynamic scraping path (Playwright when available + fallback fetch mode).
- **redis**: broker/result backend for Celery tasks.

## Implemented Endpoints

### Python service (`:8000`)
- `GET /health`
- `POST /scrape/quick`
- `POST /analyze`
- `POST /site/crawl-and-train`
- `POST /site/ask`

### Go service (`:8080`)
- `GET /health`
- `POST /scrape`
- `POST /crawl`

### Node service (`:3000`)
- `GET /health`
- `POST /scrape`

### API Gateway (`:4000`)
- `GET /health`
- `POST /graphql`
- `GET /jobs`
- `GET /stats`

Supported GraphQL operations:
- `query { jobs { ... } stats { ... } }`
- `mutation CreateJob($input: CreateJobInput!) { createJob(input: $input) { ... } }`

## Run with Docker Compose

```bash
docker compose up --build
```

Dashboard: `http://localhost:3001`

## Local Development

### Python
```bash
cd backend-python
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Go
```bash
cd backend-go
go run ./cmd/server
```

### Node backend
```bash
cd backend-node
npm install
npm start
```

### API gateway
```bash
cd api-gateway
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Set in frontend shell if needed:

```bash
export NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```


## Site-aware crawling and local QA

The Python service can now build a local retrieval model from a single site and answer questions from that site corpus.

1. Crawl and train a local model (respects `robots.txt`):

```bash
curl -X POST http://localhost:8000/site/crawl-and-train \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","max_pages":25,"max_depth":2}'
```

2. Ask questions against the trained site model:

```bash
curl -X POST http://localhost:8000/site/ask \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","question":"What products are offered?","top_k":3}'
```

The first endpoint uses the Go crawler (`/crawl`) as the primary concurrent engine, falls back to the Python crawler if Go fails or yields no pages, and finally falls back to the Node scraper (`/scrape`) if needed. It stores crawl output under `backend-python/data/` and trains a local TF-IDF retriever (no paid APIs).

Note: this is retrieval-based QA using a local TF-IDF index over crawled text, **not** LLM fine-tuning or model training.


GraphQL equivalents through the gateway:

```graphql
mutation TrainSite($url: String!, $maxPages: Int, $maxDepth: Int) {
  crawlAndTrainSite(url: $url, maxPages: $maxPages, maxDepth: $maxDepth) {
    engine
    pageCount
    artifactPath
    warnings
  }
}

query AskSite($url: String!, $question: String!, $topK: Int) {
  askSite(url: $url, question: $question, topK: $topK) {
    answer
    confidence
    citations
    snippet
  }
}
```

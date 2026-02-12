# MetaCrawler

MetaCrawler is a polyglot web-scraping platform with:

- **Python service** for quick static scraping and lightweight NLP analysis.
- **Go service** for fast static-page scraping.
- **Node service** for dynamic-page scraping attempts (Playwright first, then fetch fallback).
- **API gateway** to create/query jobs from one endpoint.
- **Next.js frontend** dashboard to submit jobs and monitor status.
- **Redis** (currently used for Python Celery broker/result backend configuration).

---

## 1) Project structure

```text
backend-python/   FastAPI + Celery tasks + scraper + NLP
backend-go/       Go HTTP scraper service
backend-node/     Express scraper service
api-gateway/      Node HTTP gateway and job orchestration
frontend/         Next.js dashboard
docker-compose.yml
```

---

## 2) Prerequisites

### Docker path (recommended)
- Docker Engine + Docker Compose plugin

### Local (without Docker)
- Python 3.11+
- Go 1.23+
- Node.js 20+

---

## 3) Quick start with Docker

From repository root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3001`
- API Gateway: `http://localhost:4000`
- Python backend: `http://localhost:8000`
- Go backend: `http://localhost:8080`
- Node backend: `http://localhost:3000`
- Redis: `localhost:6379`

Stop everything:

```bash
docker compose down
```

---

## 4) Local development (run each service manually)

> Start each command in a separate terminal.

### 4.1 Python service

```bash
cd backend-python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4.2 Go service

```bash
cd backend-go
go run ./cmd/server
```

### 4.3 Node scraper service

```bash
cd backend-node
npm install
npm start
```

### 4.4 API gateway

```bash
cd api-gateway
npm install
npm start
```

### 4.5 Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql npm run dev -- --port 3001
```

---

## 5) Environment variables

### Docker Compose defaults

The compose file already wires these:

- Gateway:
  - `GO_SERVICE_URL=http://go:8080`
  - `NODE_SERVICE_URL=http://node:3000`
  - `PYTHON_SERVICE_URL=http://python:8000`
- Frontend:
  - `NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql`
- Python:
  - `CELERY_BROKER_URL=redis://redis:6379/0`
  - `CELERY_RESULT_BACKEND=redis://redis:6379/0`

### Local equivalents

When running locally outside Docker, use localhost service URLs.

---

## 6) API reference

## Python (`:8000`)

### Health
```bash
curl http://localhost:8000/health
```

### Quick scrape
```bash
curl -X POST http://localhost:8000/scrape/quick \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

### NLP analyze
```bash
curl -X POST http://localhost:8000/analyze \
  -H 'Content-Type: application/json' \
  -d '{"text":"MetaCrawler is a great product", "tasks":["sentiment","entities","keywords"]}'
```

## Go (`:8080`)

### Health
```bash
curl http://localhost:8080/health
```

### Scrape
```bash
curl -X POST http://localhost:8080/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

## Node (`:3000`)

### Health
```bash
curl http://localhost:3000/health
```

### Dynamic scrape
```bash
curl -X POST http://localhost:3000/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

## Gateway (`:4000`)

### Health
```bash
curl http://localhost:4000/health
```

### Query jobs/stats
```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { jobs { id url type status createdAt result } stats { totalJobs queuedJobs doneJobs failedJobs } }"}'
```

### Create job (auto)
```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation CreateJob($input: CreateJobInput!) { createJob(input: $input) { id status url type createdAt } }","variables":{"input":{"url":"https://example.com","type":"auto"}}}'
```

Valid `type` values:
- `auto` (gateway infers static vs dynamic from the website)
- `static` (Go service)
- `dynamic` (Node service)
- `ai` (Python service; uses `text` for NLP if supplied)

---

## 7) How to use the app

1. Start stack (`docker compose up --build`) or local services.
2. Open frontend at `http://localhost:3001`.
3. Submit a job with URL and type.
4. Watch:
   - Metrics panel (`queued/done/failed`)
   - Recent jobs table
5. Optionally inspect gateway directly at:
   - `GET /jobs`
   - `GET /stats`
   - `POST /graphql`

---

## 8) Automatic scraper selection

When `type` is `auto`, the gateway chooses the scraper at runtime:

1. If text is provided, it selects `ai`.
2. If the hostname matches known JS-heavy domains (social/video apps), it selects `dynamic`.
3. Otherwise it fetches the page HTML and scores JS-hydration signals and script density.
4. Falls back to `dynamic` when inference cannot complete.

## 9) Current limitations (important)

- Gateway stores jobs **in memory** (restarts clear history).
- Gateway uses a lightweight “GraphQL-style” handler (string-based operation routing), not a full GraphQL engine.
- Node scraper attempts Playwright dynamically; if unavailable, it falls back to plain fetch-based extraction.
- Python Celery tasks are wired, but this repository currently runs the API process only by default.

---

## 10) Troubleshooting

- **Frontend cannot load data**
  - Verify `NEXT_PUBLIC_GRAPHQL_URL` points to gateway.
  - Check gateway health: `curl http://localhost:4000/health`
- **Service call failures in jobs**
  - Ensure Python/Go/Node services are running and reachable from gateway.
- **Port conflicts**
  - Adjust host ports in `docker-compose.yml`.

---

## 11) Useful commands

```bash
# Validate docker compose configuration
docker compose config

# Rebuild from scratch
docker compose down
docker compose up --build
```

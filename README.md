# AI Webscraping Platform — Polyglot, Modular, and Full Stack

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

### Go service (`:8080`)
- `GET /health`
- `POST /scrape`

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

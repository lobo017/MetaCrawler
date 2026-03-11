# MetaCrawler: Distributed AI-Powered Web Scraping Platform

[![Build Status](https://img.shields.io/github/actions/workflow/status/lobo017/MetaCrawler/ci.yml?branch=main)](https://github.com/lobo017/MetaCrawler/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org/)
[![Python Version](https://img.shields.io/badge/Python-3.9+-3776AB.svg)](https://python.org/)
[![Node Version](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)

MetaCrawler is an enterprise-grade, polyglot microservice architecture designed for high-performance data extraction and local intelligence. The platform dynamically selects execution environments based on scraping requirements, ranging from high-concurrency static extraction to complex, browser-based automation.

## System Architecture

The platform utilizes a decoupled microservice strategy coordinated through a central API gateway:

* **Frontend (Next.js)**: A management dashboard for job orchestration, system telemetry, and data visualization.
* **API Gateway (Node.js/Apollo)**: A unified GraphQL interface providing a secure entry point for all platform operations.
* **Intelligence Layer (Python/FastAPI)**: Manages Natural Language Processing (NLP) enrichment, including sentiment analysis and named entity recognition, alongside site-aware RAG models.
* **Extraction Layer (Go/Colly)**: High-efficiency engine optimized for rapid static page scraping and concurrent crawling.
* **Automation Layer (Node.js/Playwright)**: Dedicated service for dynamic content rendering and complex JavaScript-heavy interaction.
* **Infrastructure**: Persistent storage is managed via MongoDB, with Redis serving as the high-throughput message broker for asynchronous task distribution.

## Core Capabilities

### Polyglot Orchestration
The system automatically routes extraction tasks to the optimal engine:
* **Static Extraction**: Leverages Go for maximum throughput and low resource overhead.
* **Dynamic Automation**: Utilizes Node.js and Playwright for authenticated sessions and client-side rendering.

### Local Knowledge Models (RAG)
MetaCrawler enables the construction of local retrieval models from specific web domains. This allows for targeted, secure querying against a crawled corpus without reliance on external third-party LLM providers.

### NLP Enrichment
Extracted data is passed through an enrichment pipeline that transforms raw HTML into structured intelligence by identifying key entities and evaluating content sentiment.

## Architecture Deep Dive

Recent architectural improvements have solidified the platform for production:

* **Canonical Job Lifecycle:** Jobs strictly transition through states: `queued` → `running` → `done` | `failed`.
* **Idempotent Webhook Orchestration:** The API Gateway creates jobs instantly and assigns a UUID. For long-running processes (like multi-page crawls or ML models), background Python Celery workers dispatch status updates directly back to the Node.js API Gateway via a `POST /webhook/celery` callback route.
* **Deterministic Caching:** A Redis/Mongo-backed caching layer intercepts duplicate requests automatically using a composite key (URL + Job Type + Execution Params).
* **Observability:** All microservices (Gateway, Node, Python, Go) output uniform, flat JSON-lines to standard output. When debugging locally via Docker Compose, simply run `docker compose logs -f` and grep for a specific `jobId` to trace the full lifecycle across language boundaries.

## Deployment and Configuration

### Prerequisites
* Docker and Docker Compose
* Node.js (Local development)

### Environment Setup
1. Initialize the environment configuration:
   ```bash
   cp .env.example .env
   ```

2. Modify the `.env` file with production-specific variables and service URLs.

### Containerized Deployment

The entire stack can be initialized via Docker Compose:

```bash
docker compose up --build
```

* **Dashboard**: `http://localhost:3001`
* **GraphQL Interface**: `http://localhost:4000/graphql`

## Testing Protocols

Test suites are maintained independently for each microservice:

* **Python**: `cd backend-python && pytest tests/`
* **Go**: `cd backend-go && go test ./... -v`
* **Node & Gateway**: `cd api-gateway && npm test`

## Development Roadmap

Current development is prioritized across the following phases:

1. **Foundation**: Python data layer and multi-database integration.
2. **Performance**: Go-based high-concurrency crawling engine.
3. **Automation**: Playwright integration for dynamic content handling.
4. **Integration**: Unified GraphQL Gateway orchestration.
5. **Interface**: Next.js dashboard and analytical visualization.
6. **Optimization**: Production hardening, volume persistence, and API documentation.

---

*Maintained by [@lobo017](https://www.google.com/search?q=https://github.com/lobo017)*
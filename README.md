# MetaCrawler: Distributed AI-Powered Web Scraping Platform

[![Build Status](https://img.shields.io/github/actions/workflow/status/lobo017/MetaCrawler/ci.yml?branch=main)](https://github.com/lobo017/MetaCrawler/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org/)
[![Python Version](https://img.shields.io/badge/Python-3.9+-3776AB.svg)](https://python.org/)
[![Node Version](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)

MetaCrawler is a full-stack web scraping and analytical platform designed for high-performance data extraction and local intelligence. By utilizing a polyglot microservice architecture, the system selects the optimal language and environment for specific scraping requirements, ranging from high-concurrency static crawls to complex JavaScript-heavy automation.

## Architectural Overview

The platform is composed of several specialized services coordinated through a central gateway:

* **Frontend (Next.js)**: A dashboard interface for managing scraping jobs, monitoring system statistics, and interacting with processed data.
* **API Gateway (Node.js)**: A unified entry point providing a GraphQL interface for all platform operations, including job creation and data retrieval.
* **Backend-Python (FastAPI & Celery)**: The primary service for Natural Language Processing (NLP) enrichment, including sentiment analysis and named entity recognition. It also manages site-aware retrieval-augmented generation (RAG) models.
* **Backend-Go**: A high-efficiency service optimized for rapid static page scraping and concurrent crawling operations.
* **Backend-Node (Express & Playwright)**: Dedicated to dynamic scraping requirements, capable of rendering JavaScript-heavy content through browser automation.
* **Infrastructure**: Persistent data is managed via MongoDB, while Redis serves as the message broker for asynchronous task distribution.

## Core Capabilities

### Polyglot Scraping Engine

MetaCrawler implements a multi-tiered approach to data extraction. The system utilizes Go for speed during large-scale crawls and falls back to Node.js/Playwright when interactive elements or client-side rendering are detected.

### Site-Aware Intelligence

The platform can build local retrieval models from specific web domains. This allows users to perform targeted queries against a crawled site corpus without transmitting data to external third-party LLM providers.

### NLP Enrichment

Extracted content is processed through an enrichment layer that identifies key entities and determines sentiment, transforming raw HTML into structured, actionable intelligence.

## Technical Specifications

### GraphQL Schema

The API Gateway exposes several key operations:

* **Queries**: Retrieve job history, system performance statistics, and site-specific answers.
* **Mutations**: Initiate new scraping tasks, trigger site-aware training, and manage chat sessions.

## Configuration

Before running the application, you must configure your environment variables. The system relies on these variables to route internal traffic and connect to databases.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Update the `.env` file with your specific configurations (the defaults will work for standard local Docker deployment).

## Testing

MetaCrawler relies on specialized test suites for each microservice. To run the tests locally:

* **Python (NLP & Task Queue):**
```bash
cd backend-python
pytest tests/
```


* **Go (Scraper Engine):**
```bash
cd backend-go
go test ./... -v
```


* **Node & API Gateway:**
```bash
cd api-gateway
npm test
```


## Usage & API Documentation

The primary method of interacting with MetaCrawler programmatically is through the API Gateway's GraphQL endpoint (`http://localhost:4000/graphql`).

### Example: Submitting a Scraping Job

```graphql
mutation {
  createJob(input: {
    url: "[https://example.com](https://example.com)",
    type: "static"
  }) {
    id
    url
    status
    createdAt
  }
}
```

### Example: Querying Job Status

```graphql
query {
  jobs {
    id
    status
    result
  }
}
```

## Contributing

We welcome contributions to MetaCrawler. Please see our [CONTRIBUTING.md](https://github.com/lobo017/MetaCrawler/blob/main/CONTRIBUTING.md) for guidelines on branch naming, commit message formatting, and pull request requirements.



### Deployment

The platform is fully containerized using Docker, allowing the entire stack to be deployed with a single command:

```bash
docker compose up --build
```

### Local Development

Individual services can be run independently for development purposes:

* **Python Service**: Accessible on port 8000.
* **Go Service**: Accessible on port 8080.
* **Node Service**: Accessible on port 3000.
* **API Gateway**: Accessible on port 4000.

## Development Roadmap

Current development is structured into six phases:

1. Establishment of the Python data layer and database integrations.
2. Implementation of the high-performance Go crawling engine.
3. Integration of Node.js for browser automation and dynamic content.
4. Unification of services via the GraphQL API Gateway.
5. Development of the Next.js frontend dashboard.
6. Final optimization, volume persistence, and production documentation.
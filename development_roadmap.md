# MetaCrawler Development Roadmap

This roadmap is designed to guide you through building MetaCrawler from scratch. It is broken down into **Phases** and **Sessions**. Each session is designed to be a manageable chunk of work (approx. 2-4 hours) with clear goals and deliverables.

---

## Phase 1: The Foundation (Python & Data)
**Goal:** Establish the data layer and build the "Brain" of the operation.

### Session 1: Environment & Database Setup
- **Goals:**
    - Get Docker Compose running with Mongo, Postgres, and Redis.
    - Connect to databases using a GUI (Compass/PgAdmin) to verify.
    - Create the basic Python virtual environment.
- **Deliverable:** `docker-compose up` runs without errors; Python service can connect to Redis.

### Session 2: Basic Scraper Implementation (Python)
- **Goals:**
    - Implement `scrape_url` in `backend-python/app/scrapers/basic_scraper.py`.
    - Use `requests` to fetch HTML and `BeautifulSoup` to parse title/text.
    - Create a simple API endpoint in `main.py` to trigger this function.
- **Deliverable:** `POST /scrape/quick` returns the title and text of a given URL.

### Session 3: NLP Enrichment Layer
- **Goals:**
    - Install `spacy` or `nltk`.
    - Implement `analyze_text` in `backend-python/app/nlp/processor.py`.
    - Return sentiment score and named entities.
- **Deliverable:** `POST /analyze` accepts text and returns JSON with sentiment/entities.

### Session 4: Asynchronous Task Queue (Celery)
- **Goals:**
    - Configure Celery in `celery_worker.py`.
    - Move the scraping/NLP logic into a Celery task.
    - Trigger tasks from the FastAPI endpoints.
- **Deliverable:** Hitting the API returns a Task ID immediately; the result appears in the logs/database later.

---

## Phase 2: High-Performance Engine (Go)
**Goal:** Build the service responsible for speed and scale.

### Session 5: Go Service Setup
- **Goals:**
    - Initialize the Go module.
    - Set up a basic HTTP server (using `chi` or `gin`) in `cmd/server/main.go`.
    - Create a health check endpoint.
- **Deliverable:** `GET /health` returns 200 OK from the Go container.

### Session 6: The Scraper Engine (Colly)
- **Goals:**
    - Implement the scraping logic in `internal/scraper/engine.go` using `colly`.
    - Handle basic HTML parsing.
    - Add a "worker pool" concept (limit concurrency).
- **Deliverable:** A function that takes a URL and returns raw HTML, running efficiently.

### Session 7: Queue Consumption
- **Goals:**
    - Implement `internal/queue/consumer.go` to listen to Redis/RabbitMQ.
    - When a message arrives, trigger the Colly scraper.
- **Deliverable:** Publishing a message to Redis manually triggers the Go scraper.

---

## Phase 3: Dynamic Automation (Node.js)
**Goal:** Handle complex, JavaScript-heavy sites.

### Session 8: Browser Automation Setup
- **Goals:**
    - Set up `backend-node/src/index.ts` with Express.
    - Install Playwright/Puppeteer.
    - Create a function to launch a browser, go to a page, and take a screenshot.
- **Deliverable:** `POST /scrape` saves a screenshot of the target website.

### Session 9: Advanced Interaction
- **Goals:**
    - Handle infinite scrolling or button clicks.
    - Extract dynamic content (e.g., React-rendered text).
    - Return the data as JSON.
- **Deliverable:** Successfully scrape a site like Twitter or LinkedIn (public pages) that requires JS.

---

## Phase 4: Unification (API Gateway)
**Goal:** Create a single entry point for the frontend.

### Session 10: GraphQL Schema & Resolvers
- **Goals:**
    - Define the GraphQL schema (Job, Result, Stats).
    - Implement resolvers in `api-gateway/resolvers.js` that call the Python/Go/Node APIs.
- **Deliverable:** A GraphQL query `query { jobs { id status } }` fetches data from the microservices.

### Session 11: Job Orchestration
- **Goals:**
    - Create a mutation `createJob(url, type)` that decides which service to call.
    - Standardize the response format across all services.
- **Deliverable:** You can submit a job via GraphQL Playground and see it processed by the correct service.

---

## Phase 5: The Dashboard (Frontend)
**Goal:** Visualize the data and control the system.

### Session 12: Next.js Basics & API Integration
- **Goals:**
    - Build the `JobController` component to call your GraphQL mutation.
    - Display a list of recent jobs.
- **Deliverable:** A UI where you can type a URL, click "Scrape", and see it appear in a list.

### Session 13: Real-Time Updates & Analytics
- **Goals:**
    - Implement polling or WebSockets (optional) to update job status.
    - Build the `AnalyticsChart` to show dummy or real data.
- **Deliverable:** The dashboard updates automatically when a job finishes.

---

## Phase 6: Deployment & Polish
**Goal:** Make it production-ready.

### Session 14: Docker Composition & Networking
- **Goals:**
    - Ensure all containers talk to each other via Docker networks.
    - Persist database data with volumes.
- **Deliverable:** `docker-compose down` and `up` retains all your data.

### Session 15: Documentation & Final Review
- **Goals:**
    - Write a `README.md` explaining how to run the project.
    - Add comments to complex code blocks.
- **Deliverable:** A portfolio-ready GitHub repository.

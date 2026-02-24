/**
 * MetaCrawler - Node.js Microservice Entry Point
 * ----------------------------------------------
 * This service handles dynamic scraping tasks using Playwright.
 */

const express = require('express');
const { scrapeUrl } = require('./src/scrapers/browser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-browser' });
});

app.post('/scrape', async (req, res) => {
  const { url, selector } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    console.log(`[Node Scraper] Starting dynamic scrape for: ${url}`);
    const data = await scrapeUrl(url, selector);
    res.json(data);
  } catch (error) {
    console.error(`[Node Scraper] Error for ${url}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Node Service running on port ${PORT}`);
});
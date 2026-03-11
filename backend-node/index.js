/**
 * MetaCrawler - Node.js Microservice Entry Point
 * ----------------------------------------------
 * This service handles dynamic scraping tasks using Playwright.
 */

const express = require('express');
const { scrapeUrl } = require('./src/scrapers/browser');

const app = express();
const PORT = process.env.PORT || 3000;

const logger = {
  log: (level, msg, meta = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'node-browser',
      message: msg,
      ...meta
    }));
  },
  info: (msg, meta) => logger.log('info', msg, meta),
  error: (msg, meta) => logger.log('error', msg, { ...meta, error: meta?.error?.message || meta?.error })
};

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
    logger.info(`Starting dynamic scrape`, { url, selector, event: 'worker_dispatched' });
    const data = await scrapeUrl(url, selector);
    logger.info(`Completed dynamic scrape`, { url, event: 'status_changed', status: 'done' });
    res.json(data);
  } catch (error) {
    logger.error(`Node Scraper Error`, { url, error, event: 'status_changed', status: 'failed' });
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Node Service running on port ${PORT}`);
});
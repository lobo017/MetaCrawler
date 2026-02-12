const express = require('express');
const { scrapeUrl } = require('./src/scrapers/browser');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'node-browser' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'node-browser' });
});

app.post('/scrape', async (req, res) => {
  const { url, selector } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const data = await scrapeUrl(url, selector);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Node Service running on port ${PORT}`);
});

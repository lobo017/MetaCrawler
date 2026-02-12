/* api-gateway/resolvers.js */
const crypto = require('crypto');

const jobs = [];

const SERVICE_URLS = {
  static: process.env.GO_SERVICE_URL || 'http://localhost:8080',
  dynamic: process.env.NODE_SERVICE_URL || 'http://localhost:3000',
  ai: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
};

async function handleGraphQL(body) {
  const query = body.query || '';
  if (query.includes('mutation') && query.includes('askQuestion')) {
    const { jobId, question } = body.variables || {};
    return { askQuestion: await askQuestion(jobId, question) };
  }
  if (query.includes('mutation') && query.includes('createJob')) {
    return { createJob: await createJob(body.variables?.input || {}) };
  }
  if (query.includes('jobs') || query.includes('stats')) {
    return {
      jobs: getJobs(),
      stats: getStats(),
    };
  }
  throw new Error('Unsupported operation');
}

function getJobs() {
  return jobs;
}

function getStats() {
  return {
    totalJobs: jobs.length,
    queuedJobs: jobs.filter((job) => job.status === 'queued').length,
    doneJobs: jobs.filter((job) => job.status === 'done').length,
    failedJobs: jobs.filter((job) => job.status === 'failed').length,
  };
}

/**
 * Smart Router Logic:
 * Detects if a URL likely requires a full browser (Dynamic) or just a simple request (Static).
 */
function determineScraperType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Domains known to be Single Page Apps (SPAs) or require JS
    const dynamicDomains = [
      'twitter.com', 'x.com',
      'linkedin.com',
      'instagram.com',
      'facebook.com',
      'tiktok.com',
      'youtube.com',
      'reactjs.org'
    ];

    if (dynamicDomains.some(d => hostname.includes(d))) {
      return 'dynamic';
    }
    // Default to the high-performance Go scraper for everything else
    return 'static';
  } catch (e) {
    return 'static';
  }
}

async function createJob(input) {
  let jobType = input.type;
  
  // If 'auto', resolve the best scraper before creating the job
  if (jobType === 'auto') {
    const bestFit = determineScraperType(input.url);
    // We tag it as "(auto)" so the frontend shows that it was a smart decision
    jobType = `${bestFit} (auto)`;
  }

  const job = {
    id: crypto.randomUUID(),
    url: input.url,
    type: jobType,
    status: 'queued',
    result: null,
    createdAt: new Date().toISOString(),
  };
  jobs.unshift(job);

  try {
    // Resolve the actual internal type (remove " (auto)" suffix if present)
    const serviceType = jobType.split(' ')[0];
    
    const result = await dispatchJob({ ...input, type: serviceType });
    job.status = 'done';
    job.result = JSON.stringify(result);
  } catch (error) {
    job.status = 'failed';
    job.result = error.message;
  }

  return job;
}

async function dispatchJob(input) {
  const { url, type, selector, text } = input;
  if (!url || !type) {
    throw new Error('input.url and input.type are required');
  }

  if (type === 'static') {
    return callService(`${SERVICE_URLS.static}/scrape`, { url });
  }
  if (type === 'dynamic') {
    return callService(`${SERVICE_URLS.dynamic}/scrape`, { url, selector });
  }
  if (type === 'ai') {
    if (text) {
      return callService(`${SERVICE_URLS.ai}/analyze`, { text, tasks: ['sentiment', 'entities', 'keywords'] });
    }
    return callService(`${SERVICE_URLS.ai}/scrape/quick`, { url });
  }

  throw new Error(`Unsupported job type: ${type}`);
}

async function callService(endpoint, payload) {
  // Use generic fetch (available in Node 18+)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Service call failed (${response.status}) at ${endpoint}`);
  }
  return response.json();
}

/**
 * "Talk to Your Data" — Finds a completed job's scraped text and
 * forwards the user's question to the Python QA microservice.
 */
async function askQuestion(jobId, question) {
  if (!jobId || !question) {
    throw new Error('jobId and question are required');
  }

  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.status !== 'done') throw new Error(`Job is not complete (status: ${job.status})`);

  // Extract the scraped text from the stored JSON result
  let scrapedText = '';
  try {
    const parsed = JSON.parse(job.result);
    // Different scrapers store text in different fields
    scrapedText = parsed.text
      || (Array.isArray(parsed.content) ? parsed.content.join(' ') : '')
      || (Array.isArray(parsed.matches) ? parsed.matches.join(' ') : '')
      || '';
  } catch {
    scrapedText = job.result || '';
  }

  if (!scrapedText || scrapedText.length < 10) {
    return { answer: 'This job did not produce enough text content to analyze.', confidence: 0 };
  }

  const qaResult = await callService(`${SERVICE_URLS.ai}/qa`, {
    text: scrapedText,
    question,
  });

  return qaResult;
}

module.exports = { handleGraphQL, getJobs, getStats };
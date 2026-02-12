const crypto = require('crypto');

const jobs = [];

const SERVICE_URLS = {
  static: process.env.GO_SERVICE_URL || 'http://localhost:8080',
  dynamic: process.env.NODE_SERVICE_URL || 'http://localhost:3000',
  ai: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
};

async function handleGraphQL(body) {
  const query = body.query || '';
  if (query.includes('mutation') && query.includes('createJob')) {
    return { createJob: await createJob(body.variables?.input || {}) };
  }
  if (query.includes('mutation') && query.includes('askQuestion')) {
    const { jobId, question } = body.variables || {};
    return { askQuestion: await askQuestion(jobId, question) };
  }
  if (query.includes('jobs') || query.includes('stats')) {
    return {
      jobs: getJobs(),
      stats: getStats(),
    };
  }
  throw new Error('Unsupported operation');
}

async function askQuestion(jobId, question) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error('Job not found');
  if (job.status !== 'done' || !job.result) throw new Error('Job is not ready');

  const resultData = JSON.parse(job.result);
  
  // Normalize text extraction based on scraper type
  let text = '';
  if (resultData.Text) text = resultData.Text; // Go scraper
  else if (Array.isArray(resultData.content)) text = resultData.content.join(' '); // Node scraper
  else if (resultData.text) text = resultData.text; // Python scraper
  
  if (!text) throw new Error('No text content found in job result');

  // Call Python AI Service
  const response = await fetch(`${SERVICE_URLS.ai}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, question }),
  });

  if (!response.ok) throw new Error('QA Service failed');
  return response.json();
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

async function createJob(input) {
  const job = {
    id: crypto.randomUUID(),
    url: input.url,
    type: input.type === 'auto' ? determineScraperType(input.url) + ' (auto)' : input.type,
    status: 'queued',
    result: null,
    createdAt: new Date().toISOString(),
  };
  jobs.unshift(job);

  // We pass the resolved type to dispatchJob so the actual service call is correct
  const dispatchInput = { ...input, type: job.type.replace(' (auto)', '') };

  try {
    const result = await dispatchJob(dispatchInput);
    job.status = 'done';
    job.result = JSON.stringify(result);
  } catch (error) {
    job.status = 'failed';
    job.result = error.message;
  }

  return job;
}

/**
 * Heuristic to classify URLs.
 * If a site is known to be a Single Page App (SPA) or heavily dynamic, we use the Node/Playwright scraper.
 * Otherwise, we default to the faster, lighter Go scraper.
 */
function determineScraperType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // List of domains that typically require JS rendering
    const dynamicDomains = [
      'twitter.com', 'x.com', 
      'linkedin.com', 
      'instagram.com', 
      'facebook.com', 
      'youtube.com',
      'tiktok.com',
      'reactjs.org' // Example of a client-side rendered doc site
    ];

    if (dynamicDomains.some(domain => hostname.includes(domain))) {
      return 'dynamic';
    }
    return 'static';
  } catch (e) {
    return 'static'; // Fallback if URL parsing fails
  }
}

async function dispatchJob(input) {
  const { url, type, selector, text } = input;
  
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

module.exports = { handleGraphQL, getJobs, getStats };
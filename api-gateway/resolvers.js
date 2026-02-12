const crypto = require('crypto');

const jobs = [];

const SERVICE_URLS = {
  static: process.env.GO_SERVICE_URL || 'http://localhost:8080',
  dynamic: process.env.NODE_SERVICE_URL || 'http://localhost:3000',
  ai: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
};

const DYNAMIC_HOST_HINTS = [
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'youtube.com',
  'facebook.com',
  'reddit.com',
];

async function handleGraphQL(body) {
  const query = body.query || '';
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

async function createJob(input) {
  const selectedType = await resolveScraperType(input);
  const normalizedInput = { ...input, type: selectedType };

  const job = {
    id: crypto.randomUUID(),
    url: input.url,
    type: selectedType,
    status: 'queued',
    result: null,
    createdAt: new Date().toISOString(),
  };
  jobs.unshift(job);

  try {
    const result = await dispatchJob(normalizedInput);
    job.status = 'done';
    job.result = JSON.stringify({ selectedType, ...result });
  } catch (error) {
    job.status = 'failed';
    job.result = error.message;
  }

  return job;
}

async function resolveScraperType(input) {
  const { url, type, text } = input;
  if (!url || !type) {
    throw new Error('input.url and input.type are required');
  }

  if (type !== 'auto') {
    return type;
  }

  if (text && text.trim()) {
    return 'ai';
  }

  return inferWebsiteScraperType(url);
}

async function inferWebsiteScraperType(url) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'dynamic';
  }

  if (DYNAMIC_HOST_HINTS.some((hint) => hostname === hint || hostname.endsWith(`.${hint}`))) {
    return 'dynamic';
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'MetaCrawler/1.0 gateway-auto-selector' },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return 'dynamic';
    }

    const html = (await response.text()).slice(0, 200000);
    const dynamicSignals = [
      '__NEXT_DATA__',
      '__NUXT__',
      'id="root"',
      'id="app"',
      'data-reactroot',
      'webpack',
      'hydrateRoot(',
      'window.__INITIAL_STATE__',
      'ng-version',
      'astro-island',
    ];

    const signalCount = dynamicSignals.filter((signal) => html.includes(signal)).length;
    const scriptTagCount = (html.match(/<script\b/gi) || []).length;

    if (signalCount >= 2 || scriptTagCount >= 15) {
      return 'dynamic';
    }
    return 'static';
  } catch {
    return 'dynamic';
  }
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

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
  const job = {
    id: crypto.randomUUID(),
    url: input.url,
    type: input.type,
    status: 'queued',
    result: null,
    createdAt: new Date().toISOString(),
  };
  jobs.unshift(job);

  try {
    const result = await dispatchJob(input);
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

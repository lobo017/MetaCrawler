/* api-gateway/resolvers.js */
const crypto = require('crypto');
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/metacrawler';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Define the Job Database Schema
const jobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  url: String,
  type: String,
  status: String,
  result: String,
  chatHistory: { type: Array, default: [] }, // Format: [{ role: 'user', text: '...' }]
  createdAt: { type: Date, default: Date.now },
});

const Job = mongoose.model('Job', jobSchema);

const SERVICE_URLS = {
  static: process.env.GO_SERVICE_URL || 'http://go:8080',
  dynamic: process.env.NODE_SERVICE_URL || 'http://node:3000',
  ai: process.env.PYTHON_SERVICE_URL || 'http://python:8000',
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
  if (query.includes('mutation') && query.includes('crawlAndTrainSite')) {
    const { url, maxPages, maxDepth } = body.variables || {};
    return { crawlAndTrainSite: await crawlAndTrainSite(url, maxPages, maxDepth) };
  }
  if (query.includes('query') && query.includes('askSite')) {
    const { jobId, url, question, topK } = body.variables || {};
    return { askSite: await askSite(jobId, url, question, topK) };
  }
  if (query.includes('query') && query.includes('getChatHistory')) {
    const { jobId } = body.variables || {};
    const job = await Job.findOne({ id: jobId }).lean();
    return { getChatHistory: job?.chatHistory || [] };
  }
  if (query.includes('jobs') || query.includes('stats')) {
    return {
      jobs: await getJobs(),
      stats: await getStats(),
    };
  }
  throw new Error('Unsupported operation');
}

async function getJobs() {
  const jobs = await Job.find().sort({ createdAt: -1 }).lean();
  return jobs.map(j => ({ ...j, createdAt: j.createdAt.toISOString() }));
}

async function getStats() {
  const [totalJobs, queuedJobs, doneJobs, failedJobs] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ status: 'queued' }),
    Job.countDocuments({ status: 'done' }),
    Job.countDocuments({ status: 'failed' }),
  ]);
  return { totalJobs, queuedJobs, doneJobs, failedJobs };
}

function determineScraperType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const dynamicDomains = ['twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'reactjs.org'];
    if (dynamicDomains.some(d => hostname.includes(d))) return 'dynamic';
    return 'static';
  } catch (e) {
    return 'static';
  }
}

async function createJob(input) {
  let jobType = input.type;
  if (jobType === 'auto') {
    const bestFit = determineScraperType(input.url);
    jobType = `${bestFit} (auto)`;
  }

  const jobId = crypto.randomUUID();
  await Job.create({
    id: jobId,
    url: input.url,
    type: jobType,
    status: 'queued',
    result: null,
  });

  try {
    const serviceType = jobType.split(' ')[0];
    const result = await dispatchJob({ ...input, type: serviceType });
    await Job.findOneAndUpdate({ id: jobId }, { status: 'done', result: JSON.stringify(result) });
  } catch (error) {
    await Job.findOneAndUpdate({ id: jobId }, { status: 'failed', result: error.message });
  }

  const finalJob = await Job.findOne({ id: jobId }).lean();
  return { ...finalJob, createdAt: finalJob.createdAt.toISOString() };
}

async function dispatchJob(input) {
  const { url, type, selector, text } = input;
  if (!url || !type) throw new Error('input.url and input.type are required');

  if (type === 'static') {
    try {
      return await callService(`${SERVICE_URLS.static}/scrape`, { url });
    } catch (_error) {
      return callService(`${SERVICE_URLS.ai}/scrape/quick`, { url });
    }
  }
  if (type === 'dynamic') return callService(`${SERVICE_URLS.dynamic}/scrape`, { url, selector });
  if (type === 'ai') {
    if (text) return callService(`${SERVICE_URLS.ai}/analyze`, { text, tasks: ['sentiment', 'entities', 'keywords'] });
    return callService(`${SERVICE_URLS.ai}/scrape/quick`, { url });
  }
  if (type === 'site') return await crawlAndTrainSite(url, 25, 2);

  throw new Error(`Unsupported job type: ${type}`);
}

async function callService(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Service call failed (${response.status}) at ${endpoint}`);
  return response.json();
}

async function askQuestion(jobId, question) {
  if (!jobId || !question) throw new Error('jobId and question are required');
  const job = await Job.findOne({ id: jobId }).lean();
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.status !== 'done') throw new Error(`Job is not complete (status: ${job.status})`);

  let scrapedText = '';
  try {
    const parsed = JSON.parse(job.result);
    scrapedText = parsed.text || (Array.isArray(parsed.content) ? parsed.content.join(' ') : '') || '';
  } catch {
    scrapedText = job.result || '';
  }

  if (!scrapedText || scrapedText.length < 10) {
    return { answer: 'This job did not produce enough text content to analyze.', confidence: 0 };
  }

  // PASS THE HISTORY TO PYTHON
  const history = (job.chatHistory || []).map(msg => ({
    role: String(msg.role || ''),
    text: String(msg.text || '')
  }));
  
  const qaResult = await callService(`${SERVICE_URLS.ai}/qa`, { 
    text: scrapedText, 
    question,
    history 
  });

  if (qaResult?.answer) {
    await Job.findOneAndUpdate(
      { id: jobId },
      { $push: { chatHistory: { $each: [{ role: 'user', text: question }, { role: 'bot', text: qaResult.answer }] } } }
    );
  }
  return qaResult;
}

async function askSite(jobId, url, question, topK = 3) {
  if (!url || !question) throw new Error('url and question are required');
  
  // FETCH HISTORY FIRST
  let history = [];
  if (jobId) {
    const job = await Job.findOne({ id: jobId }).lean();
    if (job && job.chatHistory) {
      // FORCE STRINGS ONLY TO PREVENT PYTHON PYDANTIC CRASHES
      history = job.chatHistory.map(msg => ({
        role: String(msg.role || ''),
        text: String(msg.text || '')
      }));
    }
  }

  // PASS THE HISTORY TO PYTHON
  const result = await callService(`${SERVICE_URLS.ai}/site/ask`, { 
    url, 
    question, 
    top_k: topK,
    history 
  });
  
  const answer = result?.answer || '';
  
  if (jobId && answer) {
    await Job.findOneAndUpdate(
      { id: jobId },
      { $push: { chatHistory: { $each: [{ role: 'user', text: question }, { role: 'bot', text: answer }] } } }
    );
  }

  return {
    answer,
    citations: Array.isArray(result?.matches) ? result.matches.map((m) => m.url).filter(Boolean) : [],
    confidence: typeof result?.confidence === 'number' ? result.confidence : null,
    snippet: result?.matches?.[0]?.snippet || result?.answer || null,
  };
}

async function crawlAndTrainSite(url, maxPages = 25, maxDepth = 2) {
  if (!url) throw new Error('url is required');
  const result = await callService(`${SERVICE_URLS.ai}/site/crawl-and-train`, { url, max_pages: maxPages, max_depth: maxDepth });
  return {
    engine: result?.engine || 'unknown',
    pageCount: result?.training?.page_count || 0,
    artifactPath: result?.crawl_file || null,
    confidence: null,
    warnings: [],
  };
}

module.exports = { handleGraphQL, getJobs, getStats };
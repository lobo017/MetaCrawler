/* api-gateway/resolvers.js */
const crypto = require('crypto');
const mongoose = require('mongoose');

const logger = {
  log: (level, msg, meta = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'api-gateway',
      message: msg,
      ...meta
    }));
  },
  info: (msg, meta) => logger.log('info', msg, meta),
  warn: (msg, meta) => logger.log('warn', msg, meta),
  error: (msg, meta) => logger.log('error', msg, { ...meta, error: meta?.error?.message || meta?.error })
};

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/metacrawler';
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await healStuckJobs();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

/**
 * On startup, mark any job that has been stuck in 'queued' for more than
 * 5 minutes as 'failed'. This self-heals jobs that were orphaned by a
 * previous container restart mid-execution.
 */
async function healStuckJobs() {
  const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const result = await Job.updateMany(
    { status: 'queued', createdAt: { $lt: cutoff } },
    { $set: { status: 'failed', result: 'Gateway restarted — job was lost during execution.' } }
  );
  if (result.modifiedCount > 0) {
    console.warn(`⚠️  Healed ${result.modifiedCount} stuck job(s) on startup.`);
  }
}

// Define the Job Database Schema
const jobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  url: String,
  type: String,
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'] },
  result: String,
  chatHistory: { type: Array, default: [] }, // Format: [{ role: 'user', text: '...' }]
  createdAt: { type: Date, default: Date.now },
});
const Job = mongoose.model('Job', jobSchema);

// Define the Cache Database Schema
const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  result: { type: String, required: true },
  createdAt: { type: Date, expires: 86400, default: Date.now }, // TTL index: 24 hours
});
const Cache = mongoose.model('Cache', cacheSchema);

const chatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  jobIds: { type: Array, default: [] },
  chatHistory: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
});
const Chat = mongoose.model('Chat', chatSchema);

const SERVICE_URLS = {
  static: process.env.GO_SERVICE_URL || 'http://go:8080',
  dynamic: process.env.NODE_SERVICE_URL || 'http://node:3000',
  ai: process.env.PYTHON_SERVICE_URL || 'http://python:8000',
};

async function handleGraphQL(body) {
  const query = body.query || '';
  
  if (query.includes('mutation') && query.includes('createJob')) {
    return { createJob: await createJob(body.variables?.input || {}) };
  }
  if (query.includes('mutation') && query.includes('crawlAndTrainSite')) {
    const { url, maxPages, maxDepth } = body.variables || {};
    return { crawlAndTrainSite: await crawlAndTrainSite(url, maxPages, maxDepth) };
  }
  if (query.includes('mutation') && query.includes('deleteJob')) {
    const { id } = body.variables || {};
    await Job.deleteOne({ id });
    return { deleteJob: true };
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

  // --- WORKSPACE MUTATIONS ---
  if (query.includes('mutation') && query.includes('createChat')) {
    const { title, jobIds } = body.variables || {};
    const chat = await Chat.create({ id: crypto.randomUUID(), title, jobIds });
    return { createChat: { ...chat.toObject(), history: [], createdAt: chat.createdAt.toISOString() } };
  }
  if (query.includes('mutation') && query.includes('addJobsToChat')) {
    const { chatId, jobIds } = body.variables || {};
    const chat = await Chat.findOneAndUpdate({ id: chatId }, { $addToSet: { jobIds: { $each: jobIds } } }, { new: true }).lean();
    return { addJobsToChat: { ...chat, history: chat.chatHistory || [], createdAt: chat.createdAt.toISOString() } };
  }
  if (query.includes('mutation') && query.includes('deleteChat')) {
    const { id } = body.variables || {};
    await Chat.deleteOne({ id });
    return { deleteChat: true };
  }

  // --- FIXED DASHBOARD QUERY ROUTER ---
  // If the frontend is asking for jobs, stats, or chats, fetch and return them ALL.
  if (query.includes('jobs') || query.includes('stats') || query.includes('chats')) {
    const chats = await Chat.find().sort({ createdAt: -1 }).lean();
    return {
      jobs: await getJobs(),
      stats: await getStats(),
      chats: chats.map(c => ({ 
        ...c, 
        history: c.chatHistory || [], 
        createdAt: c.createdAt.toISOString() 
      }))
    };
  }
  if (query.includes('mutation') && query.includes('clearJobChat')) {
    const { jobId } = body.variables || {};
    await Job.findOneAndUpdate({ id: jobId }, { chatHistory: [] });
    return { clearJobChat: true };
  }
  if (query.includes('mutation') && query.includes('clearWorkspaceChat')) {
    const { chatId } = body.variables || {};
    await Chat.findOneAndUpdate({ id: chatId }, { chatHistory: [] });
    return { clearWorkspaceChat: true };
  }
  
  throw new Error('Unsupported operation');
}

async function handleWebhook(body) {
  const { jobId, status, result, error, metadata } = body;
  if (!jobId || !status) throw new Error('jobId and status are required');

  const job = await Job.findOne({ id: jobId }).lean();
  if (!job) throw new Error('Job not found');

  if (job.status === 'done' || job.status === 'failed') {
    logger.warn(`Ignoring Webhook`, { jobId, currentStatus: job.status, newStatus: status, reason: 'already terminal' });
    return { status: 'ignored', reason: 'already terminal' };
  }

  const updateData = { status };
  if (result) updateData.result = typeof result === 'string' ? result : JSON.stringify(result);
  if (error) updateData.result = error;

  await Job.findOneAndUpdate({ id: jobId }, updateData);
  logger.info(`Job Status Changed`, { jobId, status, event: 'webhook_received', metadata });
  return { status: 'success' };
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
  logger.info(`Job Created`, { jobId, url: input.url, type: jobType, event: 'job_created' });
  
  // 1. Immediately create the queued job in MongoDB
  await Job.create({
    id: jobId,
    url: input.url,
    type: jobType,
    status: 'queued',
    result: null,
  });

  // 2. FIRE AND FORGET: Start the scrape in the background without awaiting it!
  const serviceType = jobType.split(' ')[0];
  dispatchJob({ ...input, type: serviceType }, jobId)
    .then(async (result) => {
      if (result && result.async_task_queued) {
         logger.info(`Job Dispatched to Queue`, { jobId, type: jobType, event: 'worker_dispatched', taskId: result.taskId });
         return;
      }

      if (serviceType !== 'site') {
        try {
          let rawText = '';
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          rawText = parsed.text || (Array.isArray(parsed.content) ? parsed.content.join(' ') : '');
          if (!rawText && typeof result === 'string') rawText = result;

          if (rawText && rawText.length > 10) {
            await callService(`${SERVICE_URLS.ai}/embed`, { job_id: jobId, text: rawText });
          }
        } catch (e) {
          logger.warn(`Failed to embed job context`, { jobId, error: e.message });
        }
      }
      
      await Job.findOneAndUpdate({ id: jobId }, { status: 'done', result: JSON.stringify(result) });
      logger.info(`Job Completed`, { jobId, event: 'status_changed', status: 'done' });
    })
    .catch(async (error) => {
      logger.error(`Job Failed`, { jobId, event: 'status_changed', status: 'failed', error });
      await Job.findOneAndUpdate({ id: jobId }, { status: 'failed', result: error.message });
    });

  // 3. Return the queued job instantly to the UI
  const finalJob = await Job.findOne({ id: jobId }).lean();
  return { ...finalJob, createdAt: finalJob.createdAt.toISOString() };
}

async function dispatchJob(input, jobId) {
  const { url, type, selector, text, forceRefresh } = input;
  if (!url || !type) throw new Error('input.url and input.type are required');

  // Build a normalized Cache Key based strictly on operation intent
  const params = [url, type];
  if (selector) params.push(selector);
  if (type === 'ai' && text) params.push(crypto.createHash('md5').update(text).digest('hex'));
  const cacheKey = params.join('|');

  if (!forceRefresh) {
    try {
      const cachedItem = await Cache.findOne({ key: cacheKey }).lean();
      if (cachedItem && cachedItem.result) {
        logger.info(`Cache Hit`, { jobId, event: 'cache_hit', url });
        return JSON.parse(cachedItem.result); // Immediate hit. Bypass workers entirely.
      }
    } catch (err) {
      logger.warn('Cache fetch failed, proceeding to worker', { jobId, error: err.message });
    }
    logger.info(`Cache Miss - Dispatching to worker`, { jobId, event: 'cache_miss', type, url });
  } else {
    logger.info(`Force Refresh requested - Bypassing cache`, { jobId, event: 'force_refresh_requested', url, type });
  }

  let result;
  if (type === 'static') {
    try {
      result = await callService(`${SERVICE_URLS.static}/scrape`, { url });
    } catch (_error) {
      result = await callService(`${SERVICE_URLS.ai}/scrape/quick`, { url });
    }
  } else if (type === 'dynamic') {
    result = await callService(`${SERVICE_URLS.dynamic}/scrape`, { url, selector });
  } else if (type === 'ai') {
    if (text) result = await callService(`${SERVICE_URLS.ai}/analyze`, { text, tasks: ['sentiment', 'entities', 'keywords'] });
    else result = await callService(`${SERVICE_URLS.ai}/scrape/quick`, { url });
  } else if (type === 'site') {
    result = await crawlAndTrainSite(url, jobId, 25, 2);
  } else {
    throw new Error(`Unsupported job type: ${type}`);
  }

  // Save successful response back to the Cache
  // Do not cache asynchronous hand-offs (they cache via webhook on completion)
  try {
    if (result && !result.async_task_queued) {
       await Cache.findOneAndUpdate(
         { key: cacheKey },
         { key: cacheKey, result: JSON.stringify(result) },
         { upsert: true, new: true, setDefaultsOnInsert: true }
       );
    }
  } catch (saveErr) {
    console.warn('⚠️ Failed to cache successful result', saveErr);
  }

  return result;
}

async function callService(endpoint, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Service call failed (${response.status}) at ${endpoint}`);
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error; // Give up after 3 tries
      console.warn(`[Retry ${attempt}/${maxRetries}] Failed to call ${endpoint}. Retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
  }
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

async function crawlAndTrainSite(url, jobId, maxPages = 25, maxDepth = 2) {
  if (!url) throw new Error('url is required');

  // Step 1: Dispatch the Celery task — Python returns {task_id, status} immediately.
  const dispatch = await callService(`${SERVICE_URLS.ai}/site/crawl-and-train`, {
    url, max_pages: maxPages, max_depth: maxDepth, job_id: jobId
  });
  
  const taskId = dispatch?.task_id;
  if (!taskId) throw new Error('Python did not return a task_id for the crawl job.');

  // Async task dispatched successfully. Return marker.
  return { async_task_queued: true, taskId };
}

module.exports = { handleGraphQL, getJobs, getStats, handleWebhook };
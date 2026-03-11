/* api-gateway/index.js */
const http = require('http');
const { Readable } = require('stream'); // <-- Add this line
const { handleGraphQL, getStats, getJobs, handleWebhook } = require('./resolvers');

const port = Number(process.env.PORT || 4000);

const server = http.createServer(async (req, res) => {
  // 1. Add CORS Headers to every response
  // This tells the browser: "It's okay to accept data from other ports/domains"
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle "Preflight" OPTIONS requests
  // Browsers ask permission ("OPTIONS") before sending data ("POST"). We must say "Yes" (204 OK).
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Existing Routes ---

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { status: 'ok', service: 'api-gateway' });
  }

  if (req.method === 'GET' && req.url === '/jobs') {
    return json(res, 200, getJobs());
  }

  if (req.method === 'GET' && req.url === '/stats') {
    return json(res, 200, getStats());
  }

  if (req.method === 'POST' && req.url === '/graphql') {
    const body = await readJsonBody(req);
    try {
      const result = await handleGraphQL(body);
      return json(res, 200, { data: result });
    } catch (error) {
      console.error("GraphQL Error:", error);
      return json(res, 200, { errors: [{ message: error.message }] });
    }
  }

  // --- Webhook Route ---
  if (req.method === 'POST' && req.url === '/webhook/celery') {
    const body = await readJsonBody(req);
    try {
      const result = await handleWebhook(body);
      return json(res, 200, result);
    } catch (error) {
      console.error("Webhook Error:", error);
      return json(res, 400, { error: error.message });
    }
  }
  // --- Streaming Route ---
  if (req.method === 'POST' && req.url === '/api/chat/stream') {
    const body = await readJsonBody(req);
    // Point to your Python service's internal Docker address
    const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://python:8000';
    
    try {
      // 1. Forward the request to the Python backend
      // Note: Ensure your FastAPI has a matching @app.post("/chat/stream") route!
      // Inside api-gateway/index.js
      const aiResponse = await fetch(`${PYTHON_URL}/stream/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: body.question,
          job_ids: [body.jobId],
          history: body.history || []
        })
      });

      if (!aiResponse.ok) {
        return json(res, aiResponse.status, { error: 'Python streaming endpoint failed' });
      }

      // 2. Set headers to keep the connection open and allow chunked transfer
      res.writeHead(aiResponse.status, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Safely handle the stream
      const stream = Readable.fromWeb(aiResponse.body);
      
      // Catch socket errors so Node doesn't crash!
      stream.on('error', (err) => {
        console.error('Python Stream disconnected abruptly:', err.message);
        if (!res.headersSent) {
           res.writeHead(500, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: 'AI stream interrupted' }));
        } else {
           res.end(); 
        }
      });

      stream.pipe(res);
      return;

    } catch (error) {
      console.error("AI Streaming Proxy Error:", error);
      return json(res, 500, { error: 'Failed to contact AI service' });
    }
  }

  // If the route doesn't match any of the above:
  return json(res, 404, { error: 'not found' });
});

server.listen(port, () => {
  console.log(`API Gateway running on http://localhost:${port}`);
});

function json(res, status, payload) {
  // Ensure the Content-Type header is set alongside the existing CORS headers
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
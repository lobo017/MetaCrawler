/* api-gateway/index.js */
const http = require('http');
const { handleGraphQL, getStats, getJobs } = require('./resolvers');

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
const http = require('http');
const { handleGraphQL, getStats, getJobs } = require('./resolvers');

const port = Number(process.env.PORT || 4000);

const server = http.createServer(async (req, res) => {
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
      return json(res, 200, { errors: [{ message: error.message }] });
    }
  }

  return json(res, 404, { error: 'not found' });
});

server.listen(port, () => {
  console.log(`API Gateway running on http://localhost:${port}`);
});

function json(res, status, payload) {
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

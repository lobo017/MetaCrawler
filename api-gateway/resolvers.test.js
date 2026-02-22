const test = require('node:test');
const assert = require('node:assert/strict');

const { handleGraphQL } = require('./resolvers');

test('crawlAndTrainSite routes to python /site/crawl-and-train with mapped payload', async () => {
  const calls = [];
  global.fetch = async (endpoint, options) => {
    calls.push({ endpoint, options });
    return {
      ok: true,
      json: async () => ({ engine: 'go', crawl_file: '/tmp/a.json', blocked_count: 0, failed_count: 0, training: { page_count: 4 } }),
    };
  };

  const result = await handleGraphQL({
    query: 'mutation { crawlAndTrainSite(url:"u", maxPages:10, maxDepth:1){ engine pageCount artifactPath } }',
    variables: { url: 'https://example.com', maxPages: 10, maxDepth: 1 },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint.endsWith('/site/crawl-and-train'), true);
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload, { url: 'https://example.com', max_pages: 10, max_depth: 1 });
  assert.equal(result.crawlAndTrainSite.pageCount, 4);
});

test('askSite surfaces service errors', async () => {
  global.fetch = async () => ({ ok: false, status: 500 });

  await assert.rejects(
    () => handleGraphQL({
      query: 'query { askSite(url:"u", question:"q", topK:3){ answer } }',
      variables: { url: 'https://example.com', question: 'what?', topK: 3 },
    }),
    /Service call failed \(500\).*\/site\/ask/
  );
});

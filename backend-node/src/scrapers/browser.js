async function scrapeWithPlaywright(url, selector) {
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  const title = await page.title();
  const content = selector
    ? await page.$$eval(selector, (nodes) => nodes.map((n) => n.textContent?.trim()).filter(Boolean))
    : [await page.textContent('body')];

  await browser.close();
  return {
    url,
    title,
    selector: selector || null,
    content,
    mode: 'playwright',
  };
}

async function scrapeWithFetch(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'MetaCrawler/1.0' },
  });
  if (!response.ok) {
    throw new Error(`request failed with status ${response.status}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    url,
    title: titleMatch ? titleMatch[1].trim() : '',
    mode: 'fetch-fallback',
    content: [bodyText],
  };
}

async function scrapeUrl(url, selector) {
  try {
    return await scrapeWithPlaywright(url, selector);
  } catch (_error) {
    return scrapeWithFetch(url);
  }
}

module.exports = { scrapeUrl };

const USER_AGENT = 'MetaCrawler/1.0';

/**
 * Basic robots.txt parser. 
 * Fetches /robots.txt and checks if the path is disallowed for our User-Agent or *.
 */
async function checkRobotsTxt(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
    
    const response = await fetch(robotsUrl, { 
      headers: { 'User-Agent': USER_AGENT } 
    });

    if (!response.ok) return true; // No robots.txt usually means allow

    const text = await response.text();
    const path = urlObj.pathname;
    
    let isUserAgentActive = false;
    let isAllowing = true; // Default to allow

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [field, ...values] = trimmed.split(':');
      const value = values.join(':').trim();
      const lowerField = field.toLowerCase();

      if (lowerField === 'user-agent') {
        // Check if this block applies to us or wildcard
        isUserAgentActive = value === '*' || value.includes('MetaCrawler');
      } else if (lowerField === 'disallow' && isUserAgentActive) {
        // If we are in an active user-agent block, check the path
        if (value && path.startsWith(value)) {
          return false; // Found a matching disallow rule
        }
      } else if (lowerField === 'allow' && isUserAgentActive) {
        // Allow rules override disallow if more specific (simplified logic here)
        if (value && path.startsWith(value)) {
          return true; 
        }
      }
    }
    
    return true;
  } catch (error) {
    // If fetch fails (e.g. network err), we usually fail open or closed based on policy.
    // Here we allow it to ensure robustness against bad server config.
    console.warn('Failed to check robots.txt, assuming allowed:', error.message);
    return true;
  }
}

async function scrapeWithPlaywright(url, selector) {
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait a bit for hydration
  await page.waitForTimeout(1000);

  const title = await page.title();
  
  let content;
  if (selector) {
    content = await page.$$eval(selector, (nodes) => 
      nodes.map((n) => n.innerText?.trim()).filter(Boolean)
    );
  } else {
    // Robustness: Extract text only from body to avoid head/script noise
    content = [await page.$eval('body', (body) => body.innerText)];
  }

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
    headers: { 'user-agent': USER_AGENT },
  });
  
  if (!response.ok) {
    throw new Error(`request failed with status ${response.status}`);
  }

  const html = await response.text();
  
  // Simple extraction for fetch fallback
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  
  // Remove scripts/styles
  const cleanHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gmi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  return {
    url,
    title: titleMatch ? titleMatch[1].trim() : '',
    mode: 'fetch-fallback',
    content: [cleanHtml.trim()],
  };
}

async function scrapeUrl(url, selector) {
  // 1. Check Robots.txt
  const allowed = await checkRobotsTxt(url);
  if (!allowed) {
    throw new Error('Access denied by robots.txt');
  }

  // 2. Try scraping
  try {
    return await scrapeWithPlaywright(url, selector);
  } catch (_error) {
    console.log("Playwright failed, falling back to fetch:", _error.message);
    return scrapeWithFetch(url);
  }
}

module.exports = { scrapeUrl };
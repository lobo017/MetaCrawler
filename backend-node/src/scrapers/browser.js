/**
 * MetaCrawler - Browser Scraper Module
 */

const { chromium } = require('playwright');

async function scrapeUrl(url, selector = null) {
  let browser = null;
  try {
    // 1. Launch browser
    // --no-sandbox is required to run Chromium securely inside Docker containers
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      userAgent: 'MetaCrawler/1.0 (Dynamic AI Scraper)'
    });
    
    const page = await context.newPage();

    // 2. Navigate and wait for the SPA to finish making API calls
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    let textContent = '';
    const title = await page.title();

    // 3. Extract content
    if (selector) {
      // If the user provided a specific CSS selector, grab only that
      await page.waitForSelector(selector, { timeout: 10000 });
      textContent = await page.locator(selector).innerText();
    } else {
      // Otherwise, grab all visible text, but first delete junk elements from the DOM
      textContent = await page.evaluate(() => {
        const junkTags = document.querySelectorAll('script, style, noscript, iframe, svg, nav, footer');
        junkTags.forEach(el => el.remove());
        return document.body ? document.body.innerText : '';
      });
    }

    // 4. Normalize whitespace
    const cleanText = textContent.replace(/\s+/g, ' ').trim();

    return {
      url,
      title,
      // We return an array because your Python site_crawler.py checks for a list here
      content: [cleanText] 
    };

  } catch (error) {
    throw error;
  } finally {
    // 5. Always close the browser, even if the scrape failed, to prevent memory leaks!
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeUrl };
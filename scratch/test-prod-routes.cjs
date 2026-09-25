const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  
  for (const path of ['/events', '/organizer', '/create-event', '/check-in']) {
    await page.goto('https://uniticket-ud18.vercel.app' + path, { waitUntil: 'networkidle2' });
    const pageData = await page.evaluate(() => ({
      text: document.body.innerText,
      isBlack: document.body.children.length === 0,
    }));
    const cleanSnippet = pageData.text.slice(0, 120).replace(/\s+/g, ' ');
    console.log(`PATH: ${path} | FINAL URL: ${page.url()} | isBlack: ${pageData.isBlack} | SNIPPET: ${cleanSnippet}`);
  }
  await browser.close();
  process.exit(0);
})();

const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://uniticket-ud18.vercel.app/', { waitUntil: 'networkidle2' });

  console.log('1. INITIAL LANG:', await page.evaluate(() => localStorage.getItem('uniticket_language') || 'vi (default)'));

  // Open dropdown
  await page.evaluate(() => {
    const trigger = document.querySelector('button[aria-label*="language"], button[aria-label*="ngôn ngữ"]');
    if (trigger) trigger.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Click English option
  await page.evaluate(() => {
    const enOpt = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('English'));
    if (enOpt) enOpt.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const textEn = await page.evaluate(() => document.body.innerText);
  const storedAfterEn = await page.evaluate(() => localStorage.getItem('uniticket_language'));
  console.log('2. AFTER SWITCH TO EN:');
  console.log('   Stored lang:', storedAfterEn);
  console.log('   Text contains "Connect Phantom":', textEn.includes('Connect Phantom'));

  // F5 reload
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  const storedAfterF5 = await page.evaluate(() => localStorage.getItem('uniticket_language'));
  const textF5 = await page.evaluate(() => document.body.innerText);
  console.log('3. AFTER F5 RELOAD:');
  console.log('   Stored lang:', storedAfterF5);
  console.log('   Text still in English:', textF5.includes('Connect Phantom'));

  // Open dropdown again
  await page.evaluate(() => {
    const trigger = document.querySelector('button[aria-label*="language"], button[aria-label*="ngôn ngữ"]');
    if (trigger) trigger.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Click Tiếng Việt option
  await page.evaluate(() => {
    const viOpt = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tiếng Việt'));
    if (viOpt) viOpt.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const textVi = await page.evaluate(() => document.body.innerText);
  const storedAfterVi = await page.evaluate(() => localStorage.getItem('uniticket_language'));
  console.log('4. AFTER SWITCH BACK TO VI:');
  console.log('   Stored lang:', storedAfterVi);
  console.log('   Text contains "Kết Nối Ví Phantom" or "Sự kiện":', textVi.includes('Sự kiện') || textVi.includes('Khám phá') || textVi.includes('Phantom'));

  await browser.close();
  process.exit(0);
})();

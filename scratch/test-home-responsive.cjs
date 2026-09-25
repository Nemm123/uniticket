const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testViewport(browser, width, height, label) {
  console.log(`\n======================================================`);
  console.log(`KIỂM THỬ GIAO DIỆN VIEWPORT: ${label} (${width}x${height})`);
  console.log(`======================================================`);

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log(`[PASS] Tải trang Home thành công ở ${label}`);

    // Check horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasHorizontalOverflow = scrollWidth > clientWidth;
    console.log(`[${!hasHorizontalOverflow ? 'PASS' : 'FAIL'}] Không bị tràn ngang (scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth})`);

    // Check Hero section
    const hasHero = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.innerText.length > 0;
    });
    console.log(`[${hasHero ? 'PASS' : 'FAIL'}] HeroSection hiển thị tiêu đề hợp lệ`);

    // Check Category section
    const hasCategory = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h2')).some(h => 
        h.innerText.includes('Khám Phá Theo') || h.innerText.includes('Explore by') || h.innerText.includes('Thể Loại')
      );
    });
    console.log(`[${hasCategory ? 'PASS' : 'FAIL'}] CategoryExplore hiển thị`);

    // Check City section
    const hasCity = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h2')).some(h => 
        h.innerText.includes('Thành Phố') || h.innerText.includes('City') || h.innerText.includes('Cities')
      );
    });
    console.log(`[${hasCity ? 'PASS' : 'FAIL'}] CityExplore hiển thị`);

    // Check Featured Events
    const hasFeatured = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h2')).some(h => 
        h.innerText.includes('Sự Kiện Nổi Bật') || h.innerText.includes('Featured Events')
      );
    });
    console.log(`[${hasFeatured ? 'PASS' : 'FAIL'}] Featured Events section hiển thị`);

    // Check Event Discovery Showcase & Tabs
    const tabsInfo = await page.evaluate(() => {
      const tablist = document.querySelector('[role="tablist"]');
      if (!tablist) return null;
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')).map((t, idx) => ({
        index: idx,
        text: t.innerText.trim(),
        selected: t.getAttribute('aria-selected') === 'true'
      }));
      return tabs;
    });

    if (tabsInfo) {
      console.log(`[PASS] Showcase Tab Bar hiển thị đầy đủ ${tabsInfo.length} tabs:`, tabsInfo.map(t => t.text).join(' | '));
    } else {
      console.error(`[FAIL] Không tìm thấy Tab Bar trong Showcase!`);
    }

    // Check NFT Benefits section
    const hasNFTBenefits = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h2')).some(h => 
        h.innerText.includes('Solana') || h.innerText.includes('Blockchain') || h.innerText.includes('Đặc Quyền') || h.innerText.includes('NFT')
      );
    });
    console.log(`[${hasNFTBenefits ? 'PASS' : 'FAIL'}] NFTBenefits hiển thị`);

    // Test clicking tabs by index (0: All, 1: Music, 2: Web3, 3: Art, 4: Workshop)
    console.log(`--- Kiểm thử tương tác 5 Tabs bằng chỉ mục (Index) ---`);
    for (let i = 0; i < 5; i++) {
      const tabData = await page.evaluate((tabIdx) => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        if (!tabs[tabIdx]) return null;
        tabs[tabIdx].click();
        return {
          clickedText: tabs[tabIdx].innerText.trim()
        };
      }, i);

      await new Promise(r => setTimeout(r, 200));

      const activeTabText = await page.evaluate(() => {
        const active = document.querySelector('[role="tab"][aria-selected="true"]');
        return active ? active.innerText.trim() : null;
      });

      const cardsCount = await page.evaluate(() => {
        const showcase = document.querySelector('#event-showcase-section');
        if (!showcase) return 0;
        return showcase.querySelectorAll('article').length;
      });

      const hasEmptyState = await page.evaluate(() => {
        const showcase = document.querySelector('#event-showcase-section');
        if (!showcase) return false;
        return showcase.innerText.includes('Chưa có sự kiện') || showcase.innerText.includes('No events');
      });

      console.log(`  > Bấm Tab [${i}]: '${tabData.clickedText}' -> Active='${activeTabText}', Thẻ hiển thị=${cardsCount}, EmptyState=${hasEmptyState}`);
    }

  } catch (err) {
    console.error(`[ERROR] Kiểm thử ở ${label} thất bại:`, err.message);
  } finally {
    await page.close();
  }
}

async function testGlobalFeatures(browser) {
  console.log(`\n======================================================`);
  console.log(`KIỂM THỬ CHỨC NĂNG HỆ THỐNG (VI/EN, SEARCH, WALLET, ROLE)`);
  console.log(`======================================================`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

    // 1. Test VI -> EN -> VI
    console.log(`\n--- 1. Kiểm thử chuyển đổi ngôn ngữ VI ↔ EN ---`);
    const initialLang = await page.evaluate(() => document.documentElement.lang);
    console.log(`  > Ngôn ngữ ban đầu: ${initialLang}`);

    // Click LanguageSwitcher trigger to open menu
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Chọn ngôn ngữ / Select language"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Click 'English'
    await page.evaluate(() => {
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const enBtn = menuItems.find(b => b.innerText.includes('English'));
      if (enBtn) enBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    const enLang = await page.evaluate(() => document.documentElement.lang);
    const enTitle = await page.evaluate(() => {
      const showcaseTitle = document.querySelector('#event-showcase-section h2');
      return showcaseTitle ? showcaseTitle.innerText : '';
    });
    console.log(`  > Sau khi chọn English: lang='${enLang}', showcaseTitle='${enTitle}'`);

    // Click LanguageSwitcher trigger again
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Chọn ngôn ngữ / Select language"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Click 'Tiếng Việt'
    await page.evaluate(() => {
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const viBtn = menuItems.find(b => b.innerText.includes('Tiếng Việt'));
      if (viBtn) viBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    const viLang = await page.evaluate(() => document.documentElement.lang);
    const viTitle = await page.evaluate(() => {
      const showcaseTitle = document.querySelector('#event-showcase-section h2');
      return showcaseTitle ? showcaseTitle.innerText : '';
    });
    console.log(`  > Sau khi chọn lại Tiếng Việt: lang='${viLang}', showcaseTitle='${viTitle}'`);

    // 2. Test Search Modal (⌘K)
    console.log(`\n--- 2. Kiểm thử Search Modal ---`);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 300));

    const isSearchOpen = await page.evaluate(() => {
      const modal = document.querySelector('input[type="text"]');
      return !!modal;
    });
    console.log(`  > Bấm Ctrl+K mở Search Modal: ${isSearchOpen ? 'PASS' : 'FAIL'}`);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // 3. Test EventCard Click Navigation
    console.log(`\n--- 3. Kiểm thử Click EventCard điều hướng đến Event Detail ---`);
    const clickedEvent = await page.evaluate(() => {
      const card = document.querySelector('#event-showcase-section article');
      if (card) {
        card.click();
        return true;
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 500));
    const currentUrl = page.url();
    console.log(`  > Click EventCard: ${clickedEvent ? 'PASS' : 'FAIL'}, URL mới: ${currentUrl}`);

    // Navigate back to Home
    await page.evaluate(() => {
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Quay lại') || b.innerText.includes('Back')
      );
      if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 4. Test Wallet Modal
    console.log(`\n--- 4. Kiểm thử Nút Kết Nối Ví Phantom ---`);
    const openedWallet = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const walletBtn = buttons.find(b => b.innerText.includes('Kết Nối Ví') || b.innerText.includes('Connect Wallet') || b.innerText.includes('Ví Phantom'));
      if (walletBtn) {
        walletBtn.click();
        return true;
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 300));
    const isWalletModalVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Phantom') && document.body.innerText.includes('Solana');
    });
    console.log(`  > Mở Wallet Modal: ${isWalletModalVisible ? 'PASS' : 'FAIL'}`);

    // Close Wallet Modal if open
    await page.keyboard.press('Escape');

  } catch (err) {
    console.error(`[ERROR] Kiểm thử chức năng toàn cục thất bại:`, err.message);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('======================================================');
  console.log('KHỞI CHẠY KIỂM THỬ TRÌNH DUYỆT THỰC TẾ: CHROME HEADLESS');
  console.log('======================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    await testViewport(browser, 375, 667, 'Mobile 375px (iPhone SE)');
    await testViewport(browser, 768, 1024, 'Tablet 768px (iPad Mini)');
    await testViewport(browser, 1440, 900, 'Desktop 1440px (MacBook/PC)');
    await testGlobalFeatures(browser);
    console.log('\n[HOÀN THÀNH TẤT CẢ KIỂM THỬ TRÌNH DUYỆT]');
  } finally {
    await browser.close();
  }
}

main();

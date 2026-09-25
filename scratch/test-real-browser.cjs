const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTests() {
  console.log('====================================================');
  console.log('KHỞI CHẠY KIỂM THỬ TRÌNH DUYỆT THẬT (CHROME PUPPETEER)');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // Mở trang web local preview
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
    console.log('✓ Đã tải trang http://localhost:4173 thành công');

    // Thiết lập phiên đăng nhập ví Organizer trong localStorage
    const mockOrganizerSession = {
      token: 'jwt-organizer-auth-token-test',
      walletAddress: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      role: 'organizer',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    await page.evaluate((session) => {
      localStorage.setItem('uniticket_wallet_session', JSON.stringify(session));
      localStorage.setItem('uniticket_view_mode', 'organizer');
    }, mockOrganizerSession);

    // Chuyển hướng đến /organizer với session organizer
    await page.goto('http://localhost:4173/organizer', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    // ==========================================
    // KIỂM TRA TRẠNG THÁI KHỞI ĐẦU (ORGANIZER VIEW)
    // ==========================================
    let currentUrl = page.url();
    let pathname = new URL(currentUrl).pathname;
    let storedViewMode = await page.evaluate(() => localStorage.getItem('uniticket_view_mode'));
    let storedSession = await page.evaluate(() => localStorage.getItem('uniticket_wallet_session'));
    let hasOrganizerBadge = await page.evaluate(() => document.body.innerText.includes('Organizer'));

    console.log('\n--- TRẠNG THÁI KHỞI TẠO ---');
    console.log(`- URL: ${pathname}`);
    console.log(`- uniticket_view_mode: ${storedViewMode}`);
    console.log(`- Huy hiệu Organizer: ${hasOrganizerBadge}`);
    console.log(`- Session role: ${JSON.parse(storedSession).role}`);

    // ==========================================
    // TEST A: Organizer -> click "Xem Người tham dự" -> chuyển sang attendee
    // ==========================================
    console.log('\n----------------------------------------------------');
    console.log('[TEST A]: Click nút "Xem Người tham dự"...');
    console.log('----------------------------------------------------');

    const clickedAttendee = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.innerText.includes('Xem Người tham dự'));
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!clickedAttendee) {
      throw new Error('Không tìm thấy nút "Xem Người tham dự" trên Navbar!');
    }

    await new Promise((r) => setTimeout(r, 600));

    currentUrl = page.url();
    pathname = new URL(currentUrl).pathname;
    storedViewMode = await page.evaluate(() => localStorage.getItem('uniticket_view_mode'));
    storedSession = await page.evaluate(() => localStorage.getItem('uniticket_wallet_session'));

    const navButtons = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('button')).map((b) => b.innerText.trim());
    });

    const hasToggleToOrg = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Xem Ban tổ chức'));
    });

    console.log(`- URL sau khi bấm: "${pathname}" (Yêu cầu: "/")`);
    console.log(`- uniticket_view_mode: "${storedViewMode}" (Yêu cầu: "attendee")`);
    console.log(`- Menu điều hướng Người tham dự:`, navButtons);
    console.log(`- Xuất hiện nút "Xem Ban tổ chức": ${hasToggleToOrg}`);
    console.log(`- Phiên ví Organizer vẫn tồn tại: ${!!storedSession}`);

    const hasAttendeeNavItems = navButtons.includes('Trang Chủ') && navButtons.includes('Sự Kiện') && navButtons.includes('Vé Của Tôi');

    if (pathname !== '/' || storedViewMode !== 'attendee' || !hasAttendeeNavItems || !hasToggleToOrg) {
      throw new Error(`TEST A THẤT BẠI: pathname=${pathname}, mode=${storedViewMode}, hasToggle=${hasToggleToOrg}, nav=${JSON.stringify(navButtons)}`);
    }
    console.log('>>> TEST A THÀNH CÔNG: Chuyển hoàn hảo sang giao diện Người tham dự!');

    // ==========================================
    // TEST B: Attendee -> click "Xem Ban tổ chức" -> chuyển sang organizer
    // ==========================================
    console.log('\n----------------------------------------------------');
    console.log('[TEST B]: Click nút "Xem Ban tổ chức"...');
    console.log('----------------------------------------------------');

    const clickedOrg = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.innerText.includes('Xem Ban tổ chức'));
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!clickedOrg) {
      throw new Error('Không tìm thấy nút "Xem Ban tổ chức" trên Navbar!');
    }

    await new Promise((r) => setTimeout(r, 600));

    currentUrl = page.url();
    pathname = new URL(currentUrl).pathname;
    storedViewMode = await page.evaluate(() => localStorage.getItem('uniticket_view_mode'));

    const orgNavButtons = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('button')).map((b) => b.innerText.trim());
    });

    const hasToggleToAttendee = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Xem Người tham dự'));
    });

    console.log(`- URL sau khi bấm: "${pathname}" (Yêu cầu: "/organizer")`);
    console.log(`- uniticket_view_mode: "${storedViewMode}" (Yêu cầu: "organizer")`);
    console.log(`- Menu điều hướng Ban tổ chức:`, orgNavButtons);
    console.log(`- Xuất hiện nút "Xem Người tham dự": ${hasToggleToAttendee}`);

    const hasOrgNavItems = orgNavButtons.includes('Dashboard') || orgNavButtons.includes('Manage Events');

    if (pathname !== '/organizer' || storedViewMode !== 'organizer' || !hasOrgNavItems || !hasToggleToAttendee) {
      throw new Error(`TEST B THẤT BẠI: pathname=${pathname}, mode=${storedViewMode}, hasToggle=${hasToggleToAttendee}`);
    }
    console.log('>>> TEST B THÀNH CÔNG: Quay trở lại giao diện Ban tổ chức hoàn hảo!');

    // ==========================================
    // TEST C: Đang ở Attendee -> F5 (Reload) -> Vẫn giữ Attendee
    // ==========================================
    console.log('\n----------------------------------------------------');
    console.log('[TEST C]: Đang ở Attendee rồi F5 (Reload trang)...');
    console.log('----------------------------------------------------');

    // Chuyển sang attendee
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Xem Người tham dự'));
      btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Đang F5 (reload page)...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    currentUrl = page.url();
    pathname = new URL(currentUrl).pathname;
    storedViewMode = await page.evaluate(() => localStorage.getItem('uniticket_view_mode'));
    const f5AttendeeNav = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      return nav ? Array.from(nav.querySelectorAll('button')).map((b) => b.innerText.trim()) : [];
    });
    const f5HasToggleToOrg = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Xem Ban tổ chức'));
    });

    console.log(`- URL sau F5: "${pathname}" (Yêu cầu: "/")`);
    console.log(`- uniticket_view_mode sau F5: "${storedViewMode}" (Yêu cầu: "attendee")`);
    console.log(`- Menu sau F5:`, f5AttendeeNav);
    console.log(`- Nút "Xem Ban tổ chức" sau F5: ${f5HasToggleToOrg}`);

    if (pathname !== '/' || storedViewMode !== 'attendee' || !f5HasToggleToOrg) {
      throw new Error(`TEST C THẤT BẠI: F5 làm mất trạng thái attendee! pathname=${pathname}, mode=${storedViewMode}`);
    }
    console.log('>>> TEST C THÀNH CÔNG: F5 vẫn giữ nguyên chế độ Người tham dự!');

    // ==========================================
    // TEST D: Đang ở Organizer -> F5 (Reload) -> Vẫn giữ Organizer
    // ==========================================
    console.log('\n----------------------------------------------------');
    console.log('[TEST D]: Đang ở Organizer rồi F5 (Reload trang)...');
    console.log('----------------------------------------------------');

    // Chuyển lại sang organizer
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Xem Ban tổ chức'));
      btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Đang F5 (reload page)...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    currentUrl = page.url();
    pathname = new URL(currentUrl).pathname;
    storedViewMode = await page.evaluate(() => localStorage.getItem('uniticket_view_mode'));
    const f5OrgNav = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      return nav ? Array.from(nav.querySelectorAll('button')).map((b) => b.innerText.trim()) : [];
    });
    const f5HasToggleToAttendee = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Xem Người tham dự'));
    });

    console.log(`- URL sau F5: "${pathname}" (Yêu cầu: "/organizer")`);
    console.log(`- uniticket_view_mode sau F5: "${storedViewMode}" (Yêu cầu: "organizer")`);
    console.log(`- Menu sau F5:`, f5OrgNav);
    console.log(`- Nút "Xem Người tham dự" sau F5: ${f5HasToggleToAttendee}`);

    if (pathname !== '/organizer' || storedViewMode !== 'organizer' || !f5HasToggleToAttendee) {
      throw new Error(`TEST D THẤT BẠI: F5 làm mất trạng thái organizer! pathname=${pathname}, mode=${storedViewMode}`);
    }
    console.log('>>> TEST D THÀNH CÔNG: F5 vẫn giữ nguyên chế độ Ban tổ chức!');

    // ==========================================
    // TEST E: Chuyển Organizer -> Attendee -> Phantom vẫn connected, không popup
    // ==========================================
    console.log('\n----------------------------------------------------');
    console.log('[TEST E]: Kiểm tra tính toàn vẹn của phiên đăng nhập...');
    console.log('----------------------------------------------------');

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Xem Người tham dự'));
      btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const finalSession = await page.evaluate(() => {
      const raw = localStorage.getItem('uniticket_wallet_session');
      return raw ? JSON.parse(raw) : null;
    });

    const isModalPresent = await page.evaluate(() => {
      return !!document.querySelector('.animate-scaleUp');
    });

    const walletButtonText = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const walletBtn = buttons.find((b) => b.innerText.includes('9xQe'));
      return walletBtn ? walletBtn.innerText : null;
    });

    console.log(`- Địa chỉ ví trong session: ${finalSession?.walletAddress}`);
    console.log(`- Quyền tài khoản thực tế (authRole): ${finalSession?.role}`);
    console.log(`- Hiển thị địa chỉ ví rút gọn trên Navbar: ${walletButtonText}`);
    console.log(`- Không có WalletModal mở: ${!isModalPresent}`);

    if (!finalSession || finalSession.role !== 'organizer' || isModalPresent) {
      throw new Error('TEST E THẤT BẠI: Session bị mất hoặc có modal hiện lên!');
    }
    console.log('>>> TEST E THÀNH CÔNG: Phiên ví giữ nguyên, không disconnect, không yêu cầu ký lại!');

    console.log('\n====================================================');
    console.log('KẾT QUẢ: TẤT CẢ 5 BÀI TEST THỰC TẾ TRÊN CHROME ĐÃ ĐẠT 100%!');
    console.log('====================================================');
  } finally {
    await browser.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ LỖI:', err.message);
  process.exit(1);
});

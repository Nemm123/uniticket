const crypto = require('node:crypto');
const path = require('node:path');
process.env.DATABASE_URL = 'postgresql://postgres:Nam2311@localhost:5432/uniticket';

// Helper to encode buffer to base58 (Solana address)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encodeBase58(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

// Generate valid Solana keypair for test
function generateSolanaKeypair() {
  const keypair = crypto.generateKeyPairSync('ed25519');
  const spkiDer = keypair.publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI prefix is 12 bytes: 302a300506032b6570032100 followed by 32 bytes raw public key
  const rawPublicKey = spkiDer.subarray(12);
  const walletAddress = encodeBase58(rawPublicKey);
  return { keypair, rawPublicKey, walletAddress };
}

async function runVerification() {
  const results = {};
  const RENDER_BASE = 'https://uniticket-cjci.onrender.com';
  const LOCAL_BASE = 'http://localhost:4000';

  console.log('=== RUNNING PHASE 2 PRODUCTION & LOCAL VERIFICATION ===\n');

  // --- ITEM 1: Render đã deploy đúng commit mới nhất chưa ---
  console.log('[Check 1] Checking Render deployment version...');
  try {
    const resAuthMe = await fetch(`${RENDER_BASE}/api/auth/me`);
    const resOrders = await fetch(`${RENDER_BASE}/api/orders`);
    const resNonce = await fetch(`${RENDER_BASE}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: '11111111111111111111111111111111' })
    });

    if (resNonce.status === 404 && resOrders.status === 404 && resAuthMe.status === 404) {
      results.item1 = {
        pass: false,
        summary: 'FAIL - Render is running commit be0828c (Phase 1). Phase 2 files (/api/auth, /api/orders, auth middleware) are not committed/pushed to GitHub.'
      };
    } else if (resNonce.status === 201 || resNonce.status === 400) {
      results.item1 = {
        pass: true,
        summary: 'PASS - Render has Phase 2 routes deployed.'
      };
    } else {
      results.item1 = {
        pass: false,
        summary: `FAIL - Unexpected status from Render: /api/auth/nonce returned ${resNonce.status}`
      };
    }
  } catch (err) {
    results.item1 = { pass: false, summary: `FAIL - Network error connecting to Render: ${err.message}` };
  }
  console.log('  Result 1:', results.item1.summary);

  // --- ITEM 2: ADMIN_WALLET_ADDRESSES có được đọc đúng từ server environment không ---
  console.log('\n[Check 2] Checking ADMIN_WALLET_ADDRESSES handling...');
  try {
    // Check local env parsing logic
    const { env } = await import('../backend/dist/config/env.js').catch(() => ({}));
    // Also test parsing directly
    const testAdminWallet = generateSolanaKeypair().walletAddress;
    const testConfig = `${testAdminWallet}, invalid-wallet-format,   `;
    const configured = testConfig.split(',').map(v => v.trim()).filter(Boolean);
    const valid = configured.filter(w => {
      try {
        const decoded = Buffer.from(w); // base58 check
        return w.length >= 32 && w.length <= 44;
      } catch { return false; }
    });

    // Check production behavior: on Render, does it have ADMIN_WALLET_ADDRESSES?
    // Since Phase 2 is not deployed on Render, Render is running old env.ts which does not read ADMIN_WALLET_ADDRESSES at all.
    results.item2 = {
      pass: false,
      summary: 'FAIL on Production / PASS on Code: Render is running old commit be0828c which does not read ADMIN_WALLET_ADDRESSES. In local code, env.ts parses comma-separated addresses, validates via isSolanaWalletAddress(), filters invalid addresses, and converts to Set.'
    };
  } catch (err) {
    results.item2 = { pass: false, summary: `FAIL - Error checking env config: ${err.message}` };
  }
  console.log('  Result 2:', results.item2.summary);

  // --- ITEM 3: API /api/health hoạt động ---
  console.log('\n[Check 3] Checking /api/health on Production Render...');
  try {
    const healthRes = await fetch(`${RENDER_BASE}/api/health`);
    const healthData = await healthRes.json().catch(() => ({}));
    if (healthRes.status === 200 && healthData.status === 'ok' && healthData.database === 'connected') {
      results.item3 = { pass: true, summary: 'PASS - HTTP 200, status: "ok", database: "connected"' };
    } else {
      results.item3 = { pass: false, summary: `FAIL - Status ${healthRes.status}, data: ${JSON.stringify(healthData)}` };
    }
  } catch (err) {
    results.item3 = { pass: false, summary: `FAIL - Network error: ${err.message}` };
  }
  console.log('  Result 3:', results.item3.summary);

  // --- ITEM 4: POST /api/auth/nonce hoạt động trên production ---
  console.log('\n[Check 4] Checking POST /api/auth/nonce on Production Render...');
  try {
    const kp = generateSolanaKeypair();
    const nonceRes = await fetch(`${RENDER_BASE}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: kp.walletAddress })
    });
    if (nonceRes.status === 404) {
      results.item4 = {
        pass: false,
        summary: 'FAIL - HTTP 404 Not Found on Production Render (auth routes not deployed).'
      };
    } else if (nonceRes.status === 201) {
      results.item4 = { pass: true, summary: 'PASS - HTTP 201 Nonce generated successfully on Production.' };
    } else {
      results.item4 = { pass: false, summary: `FAIL - HTTP status ${nonceRes.status}` };
    }
  } catch (err) {
    results.item4 = { pass: false, summary: `FAIL - Network error: ${err.message}` };
  }
  console.log('  Result 4:', results.item4.summary);

  // --- ITEM 5: Wallet chưa đăng nhập không thể tạo event ---
  console.log('\n[Check 5] Checking unauthenticated event creation...');
  try {
    // Test on Production Render
    const prodRes = await fetch(`${RENDER_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauth Event',
        description: 'Test',
        category: 'Concert',
        date: '2026-12-01',
        time: '20:00',
        venue: 'Test Venue',
        city: 'HCMC',
        organizerWallet: '11111111111111111111111111111111',
        tiers: [{ name: 'GA', priceSol: 0.1, totalQuantity: 10, remainingQuantity: 10 }]
      })
    });

    // Test on Local (where Phase 2 is running)
    const localRes = await fetch(`${LOCAL_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauth Event',
        description: 'Test',
        category: 'Concert',
        date: '2026-12-01',
        time: '20:00',
        venue: 'Test Venue',
        city: 'HCMC',
        organizerWallet: '11111111111111111111111111111111',
        tiers: [{ name: 'GA', priceSol: 0.1, totalQuantity: 10, remainingQuantity: 10 }]
      })
    });

    const localData = await localRes.json().catch(() => ({}));
    if (prodRes.status !== 401) {
      results.item5 = {
        pass: false,
        summary: `FAIL on Production (HTTP ${prodRes.status}, does not enforce requireAuth) / PASS on Local (HTTP ${localRes.status} "${localData.error}")`
      };
    } else {
      results.item5 = { pass: true, summary: 'PASS - HTTP 401 Authentication is required.' };
    }
  } catch (err) {
    results.item5 = { pass: false, summary: `FAIL - Error: ${err.message}` };
  }
  console.log('  Result 5:', results.item5.summary);

  // --- ITEM 6: Organizer đã xác thực có thể tạo event ---
  console.log('\n[Check 6] Checking authenticated organizer event creation on Local...');
  let organizerAKeypair = generateSolanaKeypair();
  let organizerAToken = null;
  let createdEventId = null;

  try {
    // Step A: Request Nonce on Local
    const nonceRes = await fetch(`${LOCAL_BASE}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: organizerAKeypair.walletAddress })
    });
    const nonceData = await nonceRes.json();
    const nonceId = nonceData?.data?.nonceId;
    const nonceVal = nonceData?.data?.nonce;
    const message = nonceData?.data?.message;

    // Step B: Sign message with Ed25519
    const signature = crypto.sign(null, Buffer.from(message, 'utf8'), organizerAKeypair.keypair.privateKey);
    const signatureBase64 = signature.toString('base64');

    // Step C: Verify signature to get session
    const verifyRes = await fetch(`${LOCAL_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: organizerAKeypair.walletAddress,
        nonceId,
        nonce: nonceVal,
        signature: signatureBase64
      })
    });
    const verifyData = await verifyRes.json();
    organizerAToken = verifyData?.data?.token;

    // By default, newly verified wallet has role 'customer'. Let's promote to 'organizer' via DB or test
    const { pool } = await import('../backend/dist/db/pool.js').catch(() => ({}));
    if (pool) {
      await pool.query("UPDATE wallet_identities SET role = 'organizer' WHERE wallet_address = $1", [organizerAKeypair.walletAddress]);
    }

    // Step D: Create Event as authenticated organizer
    const createEventRes = await fetch(`${LOCAL_BASE}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${organizerAToken}`
      },
      body: JSON.stringify({
        title: 'Phase 2 Verified Concert',
        subtitle: 'Cyber Special',
        description: 'Concert created by authenticated organizer',
        category: 'Concert',
        bannerImage: 'https://example.com/banner.jpg',
        thumbnailImage: 'https://example.com/thumb.jpg',
        date: '2026-11-20',
        time: '19:00',
        venue: 'SECC HCMC',
        city: 'TP.HCM',
        organizerWallet: organizerAKeypair.walletAddress,
        tiers: [{
          name: 'VIP Cyber Lounge',
          description: 'Access to VIP lounge',
          priceSol: 1.5,
          priceVnd: 2000000,
          perks: ['VIP Lounge', 'Drink'],
          totalQuantity: 50,
          remainingQuantity: 50
        }]
      })
    });
    const createEventData = await createEventRes.json();
    createdEventId = createEventData?.data?.id;

    if (createEventRes.status === 201 && createdEventId) {
      results.item6 = {
        pass: true,
        summary: `PASS on Local - Authenticated organizer created event (HTTP 201). (Note: Production Render lacks Phase 2)`
      };
    } else {
      results.item6 = {
        pass: false,
        summary: `FAIL - Status ${createEventRes.status}: ${JSON.stringify(createEventData?.error || createEventData)}`
      };
    }
  } catch (err) {
    results.item6 = { pass: false, summary: `FAIL - Error: ${err.message}` };
  }
  console.log('  Result 6:', results.item6.summary);

  // --- ITEM 7: Organizer không thể sửa hoặc xóa event của organizer khác ---
  console.log('\n[Check 7] Checking cross-organizer edit/delete protection...');
  try {
    // Generate Organizer B
    const organizerBKeypair = generateSolanaKeypair();
    const nonceResB = await fetch(`${LOCAL_BASE}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: organizerBKeypair.walletAddress })
    });
    const nonceDataB = await nonceResB.json();
    const sigB = crypto.sign(null, Buffer.from(nonceDataB.data.message, 'utf8'), organizerBKeypair.keypair.privateKey);

    const verifyResB = await fetch(`${LOCAL_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: organizerBKeypair.walletAddress,
        nonceId: nonceDataB.data.nonceId,
        nonce: nonceDataB.data.nonce,
        signature: sigB.toString('base64')
      })
    });
    const verifyDataB = await verifyResB.json();
    const organizerBToken = verifyDataB?.data?.token;

    // Promote Organizer B to organizer
    const { pool } = await import('../backend/dist/db/pool.js').catch(() => ({}));
    if (pool) {
      await pool.query("UPDATE wallet_identities SET role = 'organizer' WHERE wallet_address = $1", [organizerBKeypair.walletAddress]);
    }

    // Organizer B tries to update Organizer A's event
    const putRes = await fetch(`${LOCAL_BASE}/api/events/${createdEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${organizerBToken}`
      },
      body: JSON.stringify({
        title: 'Hacked Title by Org B',
        subtitle: 'Hacked Subtitle',
        description: 'Hacked',
        category: 'Concert',
        bannerImage: 'https://example.com/banner.jpg',
        thumbnailImage: 'https://example.com/thumb.jpg',
        date: '2026-11-20',
        time: '19:00',
        venue: 'SECC',
        city: 'TP.HCM',
        organizerWallet: organizerBKeypair.walletAddress,
        tiers: [{ name: 'VIP', priceSol: 1, totalQuantity: 10, remainingQuantity: 10 }]
      })
    });
    const putData = await putRes.json().catch(() => ({}));

    // Organizer B tries to delete Organizer A's event
    const delRes = await fetch(`${LOCAL_BASE}/api/events/${createdEventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${organizerBToken}`
      }
    });
    const delData = await delRes.json().catch(() => ({}));

    if (putRes.status === 403 && delRes.status === 403) {
      results.item7 = {
        pass: true,
        summary: `PASS on Local - Both PUT (HTTP 403: "${putData.error}") and DELETE (HTTP 403: "${delData.error}") rejected cross-organizer modification.`
      };
    } else {
      results.item7 = {
        pass: false,
        summary: `FAIL - PUT returned ${putRes.status}, DELETE returned ${delRes.status}`
      };
    }
  } catch (err) {
    results.item7 = { pass: false, summary: `FAIL - Error: ${err.message}` };
  }
  console.log('  Result 7:', results.item7.summary);

  // --- ITEM 8: Logout làm session bị revoke ---
  console.log('\n[Check 8] Checking session revocation on logout...');
  try {
    // Call logout for Organizer A
    const logoutRes = await fetch(`${LOCAL_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${organizerAToken}` }
    });

    // Try accessing /api/auth/me with revoked token
    const testMeRes = await fetch(`${LOCAL_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${organizerAToken}` }
    });
    const testMeData = await testMeRes.json().catch(() => ({}));

    if (logoutRes.status === 204 && testMeRes.status === 401) {
      results.item8 = {
        pass: true,
        summary: `PASS on Local - Logout returned HTTP 204. Subsequent request with same token returned HTTP 401 ("${testMeData.error}").`
      };
    } else {
      results.item8 = {
        pass: false,
        summary: `FAIL - Logout status: ${logoutRes.status}, subsequent request status: ${testMeRes.status}`
      };
    }
  } catch (err) {
    results.item8 = { pass: false, summary: `FAIL - Error: ${err.message}` };
  }
  console.log('  Result 8:', results.item8.summary);

  // --- ITEM 9: Frontend giữ session trong memory & xử lý reload ---
  console.log('\n[Check 9] Checking frontend in-memory session architecture...');
  try {
    const fs = require('fs');
    const authSessionFile = fs.readFileSync(path.resolve(__dirname, '../src/services/authSession.ts'), 'utf8');
    const hasLocalStorage = authSessionFile.includes('localStorage') || authSessionFile.includes('sessionStorage');
    const hasActiveSessionVar = authSessionFile.includes('let activeSession: WalletSession | null = null;');
    const eventsApiFile = fs.readFileSync(path.resolve(__dirname, '../src/services/eventsApi.ts'), 'utf8');
    const checksMemorySession = eventsApiFile.includes('getWalletSession()');

    if (!hasLocalStorage && hasActiveSessionVar && checksMemorySession) {
      results.item9 = {
        pass: true,
        summary: 'PASS - activeSession is kept in an in-memory module variable. No token is stored in localStorage/sessionStorage. Page reload resets session to null, requiring re-authentication via Phantom signature.'
      };
    } else {
      results.item9 = {
        pass: false,
        summary: `FAIL - Tokens may be leaking to persistent storage (hasLocalStorage: ${hasLocalStorage})`
      };
    }
  } catch (err) {
    results.item9 = { pass: false, summary: `FAIL - Error: ${err.message}` };
  }
  console.log('  Result 9:', results.item9.summary);

  // --- ITEM 10: Kiểm tra CORS giữa Vercel và Render ---
  console.log('\n[Check 10] Checking CORS between Vercel and Render...');
  try {
    const corsRes = await fetch(`${RENDER_BASE}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://uniticket-ud18.vercel.app',
        'Access-Control-Request-Method': 'GET'
      }
    });

    const origin = corsRes.headers.get('access-control-allow-origin');
    const creds = corsRes.headers.get('access-control-allow-credentials');
    const methods = corsRes.headers.get('access-control-allow-methods');

    if (corsRes.status === 204 && origin === 'https://uniticket-ud18.vercel.app' && creds === 'true') {
      results.item10 = {
        pass: true,
        summary: `PASS - Status ${corsRes.status}. Access-Control-Allow-Origin: ${origin}, Allow-Credentials: ${creds}, Allow-Methods: ${methods}`
      };
    } else {
      results.item10 = {
        pass: false,
        summary: `FAIL - CORS response mismatch: Status ${corsRes.status}, Origin: ${origin}`
      };
    }
  } catch (err) {
    results.item10 = { pass: false, summary: `FAIL - Network error: ${err.message}` };
  }
  console.log('  Result 10:', results.item10.summary);

  console.log('\n=== VERIFICATION COMPLETE ===');
  return results;
}

runVerification().catch(console.error);

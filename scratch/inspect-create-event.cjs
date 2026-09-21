const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = 'C:\\Users\\bjb\\.gemini\\antigravity\\brain\\086596c3-8d0a-45d0-99f3-c22ad2f33cdb\\scratch\\edge-inspect-create';
  
  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000/create-event'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const listRes = await fetch('http://127.0.0.1:9223/json');
  const pages = await listRes.json();
  const page = pages.find(p => p.url.includes('localhost:3000')) || pages[0];
  console.log('Inspecting page:', page.url);

  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === curId) {
        ws.off('message', handler);
        resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.on('open', r));
  console.log('Connected to CDP.');

  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('uniticket_user_role', 'organizer'); location.href = '/create-event';`
  });

  // Wait 2s for React to re-mount /create-event with organizer role
  await new Promise(r => setTimeout(r, 2000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('form').parentElement;
      // Change classes to test fix
      modal.className = "fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/85 p-4 sm:p-6 pt-6 sm:pt-10 pb-12 backdrop-blur-md";
      const form = document.querySelector('form');
      form.className = "relative w-full max-w-3xl space-y-5 rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl sm:p-7";
    })()`
  });

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const header = document.querySelector('header');
      const form = document.querySelector('form');
      const titleInput = form.querySelector('input');
      const headerRect = header ? header.getBoundingClientRect() : null;
      const formRect = form ? form.getBoundingClientRect() : null;
      const titleRect = titleInput ? titleInput.getBoundingClientRect() : null;

      return {
        url: window.location.href,
        headerRect: headerRect ? { top: headerRect.top, bottom: headerRect.bottom, height: headerRect.height, zIndex: window.getComputedStyle(header).zIndex } : null,
        formRect: formRect ? { top: formRect.top, bottom: formRect.bottom, height: formRect.height } : null,
        titleRect: titleRect ? { top: titleRect.top, bottom: titleRect.bottom, height: titleRect.height } : null,
        titleInputName: titleInput ? titleInput.getAttribute('placeholder') || titleInput.name || titleInput.value : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Inspection result:\n', JSON.stringify(evalRes.result.value, null, 2));

  // Also take a screenshot to inspect visually
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:\\Users\\bjb\\.gemini\\antigravity\\brain\\086596c3-8d0a-45d0-99f3-c22ad2f33cdb\\scratch\\create-event-screen.png', Buffer.from(shot.data, 'base64'));
  console.log('Screenshot saved to scratch/create-event-screen.png');

  ws.close();
  edgeProcess.kill();
}

main().catch(console.error);

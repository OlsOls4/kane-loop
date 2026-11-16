// CDP capture v2 for the Kane Loop demo video.
// Burst screenshots (real frames at ~250ms) during the Pay interactions,
// because headless screencast only emits 2 frames on this setup.
// Cart = Mug + Hoodie only (subtotal £50, KANE10 -£5, total £45) —
// the Notebook is NOT in the core flow.
//
// Prerequisites (all in /tmp — recreate after VM replacement):
//   - forwarder:  python3 video/build/egress-forwarder.py (listens 127.0.0.1:3129)
//   - buggy build: copy loopmart/ to /tmp/kane-video/buggy, replace app.js/cart.js
//     with kane-watch/test/fixtures/buggy-loopmart/{app.js,cart.js}
//     (frozen pre-double-charge-fix; HAS the timer bind, so it works in a
//     real browser), serve on 127.0.0.1:8081 (python3 -m http.server).
//   - fixed build: copy loopmart/ to /tmp/kane-video/fixed, serve on 8082
//     (only used as fallback; the fixed segment uses the LIVE site).
//   - Chrome: ~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
//     (NOT /opt/meta-chromium/chrome — it refuses to start for CLI use).
// Run: node capture2.mjs   (outputs /tmp/kane-video/cap/ + manifest2.json)
// Verifies as it goes: totals must be £45.00, buggy ledger must be 2 rows,
// fixed ledger must be 1 row; throws otherwise.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = '/tmp/kane-video/cap';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:9222${path}`);
  return res.json();
}

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}

async function navigate(url) {
  await send('Page.navigate', { url });
  await sleep(2500);
}

async function shot(name, clip) {
  const params = { format: 'png' };
  if (clip) params.clip = { ...clip, scale: 1 };
  else params.captureBeyondViewport = true;
  const r = await send('Page.captureScreenshot', params);
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
  log('shot', name);
}

async function burst(dir, count, intervalMs) {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 });
    fs.writeFileSync(`${dir}/frame-${String(i).padStart(4, '0')}.jpg`, Buffer.from(r.data, 'base64'));
    if (i < count) await sleep(intervalMs);
  }
  log('burst', dir, count, 'frames');
}

async function addTwoItemsAndDiscount() {
  // Mug + Hoodie only: subtotal £50, KANE10 -£5, total £45.
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.product')].map(p => p.querySelector('button'));
    btns[0].click();
    btns[1].click();
    const inp = document.querySelector('#discount-code');
    inp.value = 'KANE10';
    document.querySelector('#apply-discount').click();
  })()`);
  await sleep(400);
  return evaluate(`({ subtotal: document.querySelector('#subtotal').textContent,
    discount: document.querySelector('#discount').textContent,
    total: document.querySelector('#total').textContent })`);
}

async function doubleClickPay() {
  await evaluate(`(() => {
    const b = document.querySelector('#pay-button');
    b.click();
    setTimeout(() => b.click(), 120);
  })()`);
}

async function ledgerState() {
  return evaluate(`(() => {
    const rows = [...document.querySelectorAll('#ledger-body tr')].map(tr => tr.textContent.trim().slice(0, 90));
    const conf = document.querySelector('#conf-order') ? document.querySelector('#conf-order').textContent : '';
    const flag = document.querySelector('#charge-flag') ? document.querySelector('#charge-flag').textContent : '';
    const stock = [...document.querySelectorAll('#stock-list li')].map(li => li.textContent.trim());
    return { rows, conf, flag, stock, total: document.querySelector('#total').textContent };
  })()`);
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--ignore-certificate-errors',
    '--proxy-server=http://127.0.0.1:3129',
    '--proxy-bypass-list=localhost,127.0.0.1',
    '--remote-debugging-port=9222',
    '--window-size=1366,768', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--user-data-dir=/tmp/kane-video-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  log('chrome pid', chrome.pid);
  for (let i = 0; i < 30; i++) {
    try { await getJson('/json/version'); break; } catch { await sleep(500); }
  }
  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

  // ---- A. Hook: buggy local build, Mug+Hoodie, double-click Pay ----
  log('A: buggy local build (Mug+Hoodie)');
  await navigate('http://127.0.0.1:8081/index.html');
  const totalsA = await addTwoItemsAndDiscount();
  log('A totals:', JSON.stringify(totalsA));
  if (totalsA.total !== '£45.00') throw new Error('A total is not £45.00: ' + totalsA.total);
  await evaluate(`document.querySelector('#pay-button').scrollIntoView({block:'center'})`);
  await sleep(500);
  await shot('a-cart-before-pay');
  const burstA = burst(`${OUT}/hook`, 18, 250);
  await sleep(300);
  await doubleClickPay();
  await burstA;
  await evaluate(`document.querySelector('.table-scroll').scrollIntoView({block:'center'})`);
  await sleep(600);
  await burst(`${OUT}/hook-ledger`, 6, 300);
  const ledgerA = await ledgerState();
  log('A ledger:', JSON.stringify(ledgerA));
  if (ledgerA.rows.length !== 2) throw new Error('A: expected 2 ledger rows, got ' + ledgerA.rows.length);
  const clip = await evaluate(`(() => {
    const el = document.querySelector('.table-scroll');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
  })()`);
  await shot('a-ledger-crop', clip);
  await shot('a-full-after', null);

  // ---- B. Console (live) ----
  log('B: live console');
  await navigate('https://kane-loop-loopmart.vercel.app/console.html');
  await evaluate(`window.scrollTo(0,0)`);
  await sleep(500);
  await shot('b-console-top');
  await evaluate(`document.querySelector('#timeline').scrollIntoView({block:'start'})`);
  await sleep(400);
  await shot('b-console-timeline');
  await evaluate(`document.querySelector('#ndjson').scrollIntoView({block:'start'})`);
  await sleep(400);
  await shot('b-console-ndjson');

  // ---- C. Fixed build (live): Reset toggle -> double-click -> 1 order ----
  log('C: live fixed build');
  await navigate('https://kane-loop-loopmart.vercel.app/index.html');
  await evaluate(`document.querySelector('#reset-bug').click()`);
  await sleep(400);
  const bugStatusAfter = await evaluate(`document.querySelector('#bug-status').textContent`);
  log('C bug status after Reset:', bugStatusAfter);
  const totalsC = await addTwoItemsAndDiscount();
  log('C totals:', JSON.stringify(totalsC));
  if (totalsC.total !== '£45.00') throw new Error('C total is not £45.00: ' + totalsC.total);
  await evaluate(`document.querySelector('#pay-button').scrollIntoView({block:'center'})`);
  await sleep(500);
  await shot('c-cart-before-pay');
  const burstC = burst(`${OUT}/fixed`, 18, 250);
  await sleep(300);
  await doubleClickPay();
  await burstC;
  await evaluate(`document.querySelector('#confirmation').scrollIntoView({block:'center'})`);
  await sleep(600);
  await burst(`${OUT}/fixed-confirm`, 6, 300);
  const ledgerC = await ledgerState();
  log('C ledger:', JSON.stringify(ledgerC));
  if (ledgerC.rows.length !== 1) throw new Error('C: expected 1 ledger row, got ' + ledgerC.rows.length);
  await shot('c-full-after', null);

  // ---- D. Live checkout establishing still ----
  log('D: live checkout still');
  await navigate('https://kane-loop-loopmart.vercel.app/index.html');
  await sleep(800);
  await shot('d-live-checkout-top');

  const manifest = { totalsA, ledgerA, totalsC, ledgerC, bugStatusAfter };
  fs.writeFileSync(`${OUT}/manifest2.json`, JSON.stringify(manifest, null, 2));
  log('done', JSON.stringify(manifest));
  ws.close();
  chrome.kill('SIGTERM');
  process.exit(0);
}

main().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });

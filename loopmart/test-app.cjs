'use strict';
/**
 * LoopMart DOM wiring tests — docs/loopmart-spec.md §3.
 * Drives loopmart/app.js with a fake document (no browser): verifies
 * the page renders, the demo button, discount messages, the Pay button
 * label, the 1s Processing state, the confirmation, the ledger, and the
 * double-click / retry paths in both modes, plus Break it / Reset.
 * Run: `node loopmart/test-app.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const initLoopMart = require('./app.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

/* Minimal fake DOM element: enough for app.js (createElement,
 * getElementById, innerHTML, textContent, hidden, disabled, onclick,
 * setAttribute, appendChild, scrollIntoView). */
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.onclick = null;
    this.value = '';
    this.attrs = {};
    this._html = '';
  }
  set innerHTML(v) { this._html = v; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  scrollIntoView() {}
  focus() { this.focused = true; }
  click() { if (this.onclick) this.onclick(); }
  findAll(pred, acc) {
    acc = acc || [];
    if (pred(this)) acc.push(this);
    for (const c of this.children) c.findAll(pred, acc);
    return acc;
  }
}

class FakeDoc {
  constructor() { this.byId = {}; }
  getElementById(id) {
    if (!this.byId[id]) this.byId[id] = new FakeEl('div');
    return this.byId[id];
  }
  createElement(tag) { return new FakeEl(tag); }
}

function makeApp(search) {
  const doc = new FakeDoc();
  const timers = { fns: [], setTimeout(fn) { this.fns.push(fn); return this.fns.length; } };
  // Mirror the real page: the pay form is pre-filled with test values.
  doc.getElementById('pay-name').value = 'Test Buyer';
  doc.getElementById('pay-card').value = '4242 4242 4242 4242';
  doc.getElementById('pay-expiry').value = '12/30';
  doc.getElementById('pay-cvc').value = '123';
  const app = initLoopMart(doc, { search: search || '', timers: timers });
  return { doc: doc, timers: timers, app: app, state: app.state };
}

function text(doc, id) { return doc.getElementById(id).textContent; }
function ledgerRows(doc) {
  // Real order rows only — the "No orders yet." placeholder is not one.
  return doc.getElementById('ledger-body').findAll((e) => e.tag === 'tr')
    .filter((tr) => tr.children[0] && tr.children[0].textContent.indexOf('LOOP-') === 0);
}
function stockText(doc) {
  return doc.getElementById('stock-list').findAll((e) => e.tag === 'li').map((li) => li.textContent);
}

check('fresh load: empty cart, total £0.00, guard active (fixed by default)', () => {
  const { doc } = makeApp('');
  // (The fake document carries no static HTML text; the empty-cart line
  // itself is verified in the real page. Here we check the rendered state.)
  assert.equal(doc.getElementById('cart-empty').hidden, false);
  assert.equal(text(doc, 'total'), '£0.00');
  assert.equal(text(doc, 'bug-status'), 'Seeded bug OFF — guard active: one charge per checkout (correct behaviour).');
  assert.equal(doc.getElementById('confirmation').hidden, true);
  // Stock renders on a cold load (UI/UX bug, 15 Nov): 10/10/10.
  assert.deepEqual(stockText(doc), [
    'Loop Mug — 10 in stock', 'Debug Hoodie — 10 in stock', 'Kane Notebook — 10 in stock',
  ]);
  // Pay is disabled on an empty cart, with the reason in text.
  assert.equal(doc.getElementById('pay-button').disabled, true);
  assert.equal(text(doc, 'pay-status'), 'Cart is empty — add a product first.');
});

check('demo button fills Mug + Hoodie: subtotal £50, Pay label carries £50', () => {
  const { doc } = makeApp('');
  doc.getElementById('demo-add').click();
  assert.equal(text(doc, 'subtotal'), '£50.00');
  assert.equal(text(doc, 'total'), '£50.00');
  assert.equal(text(doc, 'pay-button'), 'Pay £50.00 — test, no money moves');
});

check('KANE10 applies once; wrong code shows the try-KANE10 message', () => {
  const { doc } = makeApp('');
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'WRONG';
  doc.getElementById('apply-discount').click();
  assert.equal(text(doc, 'discount-msg'), 'Code not recognised — try KANE10');
  assert.equal(text(doc, 'total'), '£50.00');
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  assert.equal(text(doc, 'total'), '£45.00');
  assert.equal(text(doc, 'discount'), '−£5.00');
  doc.getElementById('apply-discount').click();
  assert.equal(text(doc, 'discount-msg'), 'Code already applied — it does not apply twice.');
  assert.equal(text(doc, 'total'), '£45.00');
});

check('Pay once (fixed default): Processing… then LOOP-1001, £45, 1 ledger order, stock 9/9', () => {
  const { doc, timers } = makeApp('');
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  doc.getElementById('pay-button').click();
  assert.equal(text(doc, 'pay-button'), 'Processing…');
  assert.equal(doc.getElementById('confirmation').hidden, true);
  // The charge lands when Processing ends: mid-flight the ledger shows
  // no order, so ledger and confirmation never disagree.
  assert.equal(ledgerRows(doc).length, 0);
  assert.equal(timers.fns.length, 1);
  timers.fns[0](); // the 1s processing delay elapses: charge + confirmation land together
  assert.equal(doc.getElementById('confirmation').hidden, false);
  assert.equal(text(doc, 'conf-order'), 'LOOP-1001');
  assert.equal(text(doc, 'conf-total'), 'Total paid £45.00 (discount £5.00 applied)');
  assert.equal(ledgerRows(doc).length, 1);
  assert.deepEqual(stockText(doc), [
    'Loop Mug — 9 in stock', 'Debug Hoodie — 9 in stock', 'Kane Notebook — 10 in stock',
  ]);
  // Focus moves to the confirmation so a keyboard/screen-reader user lands on the result.
  assert.equal(doc.getElementById('confirmation').focused, true);
  // No anomaly flag on a single charge.
  assert.equal(doc.getElementById('charge-flag').hidden, true);
  assert.equal(text(doc, 'ledger-summary'), '1 order, total £45.00');
});

check('buggy mode (?mode=buggy): double-click Pay during Processing = 2 orders, LOOP-1001 + LOOP-1002, anomaly flag (seeded bug, re-armed 15 Nov)', () => {
  const { doc, timers } = makeApp('?mode=buggy');
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  doc.getElementById('pay-button').click(); // Processing… starts, charge queued
  doc.getElementById('pay-button').click(); // double-click: second charge queued (seeded bug)
  assert.equal(ledgerRows(doc).length, 0, 'no ledger row before Processing ends');
  timers.fns[0]();
  assert.equal(text(doc, 'conf-order'), 'LOOP-1002');
  assert.equal(ledgerRows(doc).length, 2);
  assert.deepEqual(stockText(doc), [
    'Loop Mug — 8 in stock', 'Debug Hoodie — 8 in stock', 'Kane Notebook — 10 in stock',
  ]);
  // The anomaly flag names both charges in text, not colour-only.
  assert.equal(doc.getElementById('charge-flag').hidden, false);
  assert.equal(text(doc, 'charge-flag'), '⚠ 2 charges for one checkout — expected 1 (LOOP-1001, LOOP-1002)');
  assert.equal(text(doc, 'ledger-summary'), '2 orders, total £90.00');
});

check('default load is fixed (15 Nov): double-click Pay on a fresh load = 1 order, stock −1 each, no duplicate', () => {
  const { doc, timers } = makeApp('');
  assert.equal(text(doc, 'bug-status'), 'Seeded bug OFF — guard active: one charge per checkout (correct behaviour).');
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  doc.getElementById('pay-button').click(); // Processing… starts, charge queued
  doc.getElementById('pay-button').click(); // double-click: ignored in fixed mode
  assert.equal(ledgerRows(doc).length, 0, 'no ledger row before Processing ends');
  timers.fns[0]();
  assert.equal(text(doc, 'conf-order'), 'LOOP-1001');
  assert.equal(ledgerRows(doc).length, 1);
  assert.deepEqual(stockText(doc), [
    'Loop Mug — 9 in stock', 'Debug Hoodie — 9 in stock', 'Kane Notebook — 10 in stock',
  ]);
  assert.equal(doc.getElementById('charge-flag').hidden, true, 'no anomaly flag on a single charge');
  assert.equal(text(doc, 'ledger-summary'), '1 order, total £45.00');
});

check('retry after confirmation is ignored (unreachable in a real browser: pay section is hidden)', () => {
  const { doc, timers } = makeApp('');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(ledgerRows(doc).length, 1);
  doc.getElementById('pay-button').click(); // handler ignores it; no second charge
  assert.equal(ledgerRows(doc).length, 1);
  assert.equal(text(doc, 'conf-order'), 'LOOP-1001');
});

check('fixed mode (?mode=fixed): double-click and retry stay at 1 order', () => {
  const { doc, timers } = makeApp('?mode=fixed');
  assert.equal(text(doc, 'bug-status'), 'Seeded bug OFF — guard active: one charge per checkout (correct behaviour).');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  doc.getElementById('pay-button').click(); // disabled in fixed mode; handler ignores
  timers.fns[0]();
  assert.equal(ledgerRows(doc).length, 1);
  doc.getElementById('pay-button').click();
  assert.equal(ledgerRows(doc).length, 1);
});

check('Reset restores correct behaviour; Break it re-arms the bug', () => {
  const { doc, timers } = makeApp('');
  doc.getElementById('reset-bug').click();
  assert.equal(text(doc, 'bug-status'), 'Seeded bug OFF — guard active: one charge per checkout (correct behaviour).');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(ledgerRows(doc).length, 1);
  doc.getElementById('break-it').click();
  assert.equal(text(doc, 'bug-status'), 'Seeded bug ARMED: double-charge on double-click Pay during Processing.');
  // G1 fixed 15 Nov: Break it resets the store but the completed order
  // survives in the ledger (spec §3.4); only the cart total resets.
  assert.equal(ledgerRows(doc).length, 1);
  assert.equal(text(doc, 'total'), '£0.00');
});

check('Start new order resets the cart and order numbers continue', () => {
  const { doc, timers } = makeApp('?mode=fixed');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(text(doc, 'conf-order'), 'LOOP-1001');
  doc.getElementById('new-order').click();
  assert.equal(text(doc, 'total'), '£0.00');
  assert.equal(doc.getElementById('confirmation').hidden, true);
  // Stock is back to 10/10/10 after Start new order (regression: stale 9/9/10).
  assert.deepEqual(stockText(doc), [
    'Loop Mug — 10 in stock', 'Debug Hoodie — 10 in stock', 'Kane Notebook — 10 in stock',
  ]);
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  timers.fns[1]();
  assert.equal(text(doc, 'conf-order'), 'LOOP-1002');
});

// UI/UX + user-panel hardening, 15 Nov 2026.
check('empty-cart Pay is a disabled button with the reason in text, not a silent no-op', () => {
  const { doc } = makeApp('');
  assert.equal(doc.getElementById('pay-button').disabled, true);
  assert.equal(text(doc, 'pay-status'), 'Cart is empty — add a product first.');
  doc.getElementById('pay-button').click();
  assert.equal(ledgerRows(doc).length, 0);
  doc.getElementById('demo-add').click();
  assert.equal(doc.getElementById('pay-button').disabled, false);
  assert.equal(text(doc, 'pay-status'), '');
});

check('pay form is validated: an empty card blocks the charge with a message', () => {
  const { doc, timers } = makeApp('');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-card').value = '';
  doc.getElementById('pay-button').click();
  assert.equal(text(doc, 'pay-status'), 'Fill in name, card, expiry and CVC — test values are pre-filled.');
  assert.equal(timers.fns.length, 0, 'no Processing timer: nothing charged');
  assert.equal(ledgerRows(doc).length, 0);
  doc.getElementById('pay-card').value = '4242 4242 4242 4242';
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(ledgerRows(doc).length, 1);
});

check('steppers carry product-named aria-labels; confirmation + ledger summary are aria-live', () => {
  const { doc } = makeApp('');
  doc.getElementById('demo-add').click();
  const steppers = doc.getElementById('products')
    .findAll((e) => e.tag === 'button' && /quantity$/.test(e.attrs['aria-label'] || ''));
  assert.ok(steppers.some((b) => b.attrs['aria-label'] === 'Decrease Loop Mug quantity'));
  assert.ok(steppers.some((b) => b.attrs['aria-label'] === 'Increase Debug Hoodie quantity'));
  const addBtns = doc.getElementById('products')
    .findAll((e) => e.tag === 'button' && /^Add /.test(e.attrs['aria-label'] || ''));
  assert.ok(addBtns.some((b) => b.attrs['aria-label'] === 'Add Kane Notebook to cart'));
  // aria-live attributes live in the static HTML; verify them there.
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(/id="confirmation"[^>]*aria-live="polite"/.test(html));
  assert.ok(/id="ledger-summary"[^>]*aria-live="polite"/.test(html));
  assert.ok(/id="pay-status"[^>]*role="status"/.test(html));
  assert.ok(/class="skip-link"[^>]*href="#main"/.test(html));
  assert.ok(/<main id="main">/.test(html));
  assert.ok(/<noscript>/.test(html));
  assert.ok(/:focus-visible/.test(html));
  assert.ok(/@media \(max-width: 900px\)/.test(html));
  assert.ok(/class="table-scroll"/.test(html));
});

check('id inventory: every id app.js references exists in index.html', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  // app.js reaches the DOM through el('id') (a getElementById wrapper)
  // and the occasional direct getElementById('id').
  const ids = new Set([
    ...[...js.matchAll(/(?:getElementById|\bel)\('([^']+)'\)/g)].map((m) => m[1]),
  ]);
  assert.ok(ids.size > 10, 'inventory is non-trivial (' + ids.size + ' ids)');
  const missing = [...ids].filter((id) => !html.includes('id="' + id + '"'));
  assert.deepEqual(missing, [], 'all app.js ids exist in index.html');
});

check('keyboard-only walkthrough: demo-add -> KANE10 -> Pay -> confirmation + ledger readable', () => {
  const { doc, timers } = makeApp('');
  // Keyboard activation is a click on the focused control; no mouse is used.
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  assert.equal(text(doc, 'discount-msg'), 'KANE10 applied — 10% off.');
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(doc.getElementById('confirmation').hidden, false);
  assert.equal(doc.getElementById('confirmation').focused, true);
  assert.equal(text(doc, 'conf-total'), 'Total paid £45.00 (discount £5.00 applied)');
  assert.equal(text(doc, 'ledger-summary'), '1 order, total £45.00');
  // The "View run" button is renamed in the static HTML (it scrolls to the
  // seeded-bug controls, not to any run); the fake DOM carries no static text.
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(/id="view-run">Seeded bug controls</.test(html));
});

check('G1 fixed 15 Nov: the note is in the seeded box (visible before any order), not hidden inside #confirmation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  // The note moved out of #confirmation (hidden until an order
  // completes) into the seeded box, which is always visible.
  const noteStart = html.indexOf('id="g1-note"');
  const seededStart = html.indexOf('id="seeded-box"');
  const ledgerHeading = html.indexOf('<h2>Order ledger</h2>');
  assert.ok(noteStart !== -1 && seededStart !== -1 && ledgerHeading !== -1);
  assert.ok(noteStart > seededStart, 'the G1 note is inside the seeded box');
  assert.ok(noteStart > ledgerHeading, 'the G1 note is past the #confirmation block entirely');
  assert.ok(/G1 fixed 15 Nov/.test(html), 'the note says G1 is fixed');
  assert.ok(/ledger now persists across orders/.test(html), 'the note states the fixed behaviour plainly');
});

check('G1 FIXED (15 Nov): Start new order keeps the ledger — both orders survive', () => {
  const { doc, timers } = makeApp('?mode=fixed');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  timers.fns[0]();
  assert.equal(ledgerRows(doc).length, 1);
  doc.getElementById('new-order').click();
  // The completed order stays in the ledger (spec §3.4: every completed
  // order is appended to a visible ledger). G1 fixed by the fixer's
  // g1-ledger-preserve strategy; see README Known issues.
  assert.equal(ledgerRows(doc).length, 1, 'the first order survives "Start new order"');
  doc.getElementById('demo-add').click();
  doc.getElementById('pay-button').click();
  timers.fns[1]();
  assert.equal(text(doc, 'conf-order'), 'LOOP-1002');
  assert.equal(ledgerRows(doc).length, 2, 'both orders are in the ledger');
});

check('REGRESSION (live Kane O1, 15 Nov): default timers are bound — Pay works with a browser-strict setTimeout', () => {
  // A real browser's window.setTimeout throws "TypeError: Illegal
  // invocation" when called with `this` !== window. Node/jsdom tolerate
  // detached calls, which is why the DOM suite missed the bug: app.js
  // stored the bare global and called it as timers.setTimeout(...), so
  // in Chrome the 1s timer never fired, Pay stuck on Processing, and no
  // charge ever landed (live Kane run O1, steps 1–19 passed, step 20
  // failed, result_code 740). This test swaps in a browser-strict timer
  // before init and drives Pay with NO injected timers (the default
  // path). It fails on the old code (TypeError inside the Pay click)
  // and passes once the default timers are bound to the global object.
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  const fns = [];
  function strictSetTimeout(fn) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    fns.push(fn);
    return fns.length;
  }
  function strictClearTimeout() {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
  }
  global.setTimeout = strictSetTimeout;
  global.clearTimeout = strictClearTimeout;
  try {
    const doc = new FakeDoc();
    doc.getElementById('pay-name').value = 'Test Buyer';
    doc.getElementById('pay-card').value = '4242 4242 4242 4242';
    doc.getElementById('pay-expiry').value = '12/30';
    doc.getElementById('pay-cvc').value = '123';
    const app = initLoopMart(doc, { search: '' }); // no timers option: default path
    doc.getElementById('demo-add').click();
    doc.getElementById('pay-button').click();
    assert.equal(fns.length, 1, 'the 1s Processing timer was scheduled');
    fns[0](); // the Processing delay elapses: charge + confirmation land
    assert.equal(doc.getElementById('confirmation').hidden, false);
    assert.equal(text(doc, 'conf-order'), 'LOOP-1001');
    assert.equal(ledgerRows(doc).length, 1);
    assert.equal(app.state.orders.length, 1);
  } finally {
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
});

console.log(passed + ' LoopMart DOM wiring tests passed');

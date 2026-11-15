'use strict';
/**
 * Fixer + sweep tests — docs/loop-design.md §4 (fix contract), §8
 * (independent second check + anti-cheat), prep 02 O2.
 * No live Kane run: the fixer patches a temp working copy of loopmart/
 * and the sweep runs deterministically against LoopMart logic.
 * Run: `node kane-watch/test/run-fixer.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { parseNdjson } = require('../src/parse-ndjson.js');
const { validateFix } = require('../src/classifier.js');
const { dispatchFix, rollbackFix, fixPromptFor, strategyFor } = require('../src/fixer.js');
const { runSweep } = require('../src/sweep.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

const ROOT = path.join(__dirname, '..', '..');
const SEEDED = fs.readFileSync(path.join(__dirname, 'fixtures', 'seeded-double-charge.ndjson'), 'utf8');

function freshWorkdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-fixer-'));
  // Seed from the frozen buggy fixture, not the live files: the fix has
  // shipped, so the live loopmart/ is patched and the fixer's anchors
  // no longer match it (see fixtures/buggy-loopmart/README.md).
  execSync('cp -r ' + path.join(__dirname, 'fixtures', 'buggy-loopmart') + ' ' + path.join(dir, 'loopmart'));
  return dir;
}

function seededParsed() {
  return parseNdjson(SEEDED, 'run', 1, 54000);
}

function loadCart(workdir) {
  const p = path.join(workdir, 'loopmart', 'cart.js');
  delete require.cache[require.resolve(p)];
  return require(p);
}

check('fixer dispatches on the seeded double-charge verdict and patches within the contract', () => {
  const dir = freshWorkdir();
  const fix = dispatchFix(seededParsed(), dir);
  assert.equal(fix.ok, true, fix.reason || '');
  assert.equal(fix.strategy, 'double-charge-idempotency-guard');
  assert.equal(fix.diff.length, 2);
  const total = fix.diff.reduce((s, f) => s + f.added + f.removed, 0);
  assert.ok(total <= 30, 'diff is ' + total + ' lines, within the 30-line contract');
  assert.ok(fix.diff.every((f) => /^loopmart\//.test(f.path)));
  assert.ok(fix.shaBefore['loopmart/cart.js']);
  assert.ok(fix.shaAfter['loopmart/cart.js'] !== fix.shaBefore['loopmart/cart.js']);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('patched copy: double-click Pay is one order in BOTH modes, A1–A5 all pass', () => {
  const dir = freshWorkdir();
  const fix = dispatchFix(seededParsed(), dir);
  assert.equal(fix.ok, true);
  const LM = loadCart(dir);
  for (const mode of ['buggy', 'fixed']) {
    const s = LM.freshState(mode);
    LM.addToCart(s, 'mug', 1);
    LM.addToCart(s, 'hoodie', 1);
    LM.applyDiscount(s, 'KANE10');
    const exp = LM.snapshotCheckout(s);
    LM.pay(s);
    LM.pay(s);
    assert.equal(s.orders.length, 1, mode + ' mode still double-charges');
    assert.deepEqual(LM.assertions(s, exp), { A1: true, A2: true, A3: true, A4: true, A5: true });
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

check('patched copy: the DOM layer double-click is one order (patched app.js)', () => {
  const dir = freshWorkdir();
  const fix = dispatchFix(seededParsed(), dir);
  assert.equal(fix.ok, true);
  // Minimal fake document: enough for app.js (same shape as loopmart/test-app.cjs).
  class FakeEl {
    constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.hidden = false; this.disabled = false; this.onclick = null; this.value = ''; this.attrs = {}; this._html = ''; }
    set innerHTML(v) { this._html = v; this.children = []; }
    get innerHTML() { return this._html; }
    setAttribute(k, v) { this.attrs[k] = v; }
    appendChild(c) { this.children.push(c); return c; }
    scrollIntoView() {}
    focus() { this.focused = true; }
    click() { if (this.onclick) this.onclick(); }
    findAll(pred, acc) { acc = acc || []; if (pred(this)) acc.push(this); for (const c of this.children) c.findAll(pred, acc); return acc; }
  }
  class FakeDoc {
    constructor() { this.byId = {}; }
    getElementById(id) { if (!this.byId[id]) this.byId[id] = new FakeEl('div'); return this.byId[id]; }
    createElement(tag) { return new FakeEl(tag); }
  }
  const appPath = path.join(dir, 'loopmart', 'app.js');
  delete require.cache[require.resolve(appPath)];
  const initLoopMart = require(appPath);
  const doc = new FakeDoc();
  doc.getElementById('pay-name').value = 'Test Buyer';
  doc.getElementById('pay-card').value = '4242 4242 4242 4242';
  doc.getElementById('pay-expiry').value = '12/30';
  doc.getElementById('pay-cvc').value = '123';
  const timers = { fns: [], setTimeout(fn) { this.fns.push(fn); return this.fns.length; } };
  initLoopMart(doc, { search: '', timers: timers });
  doc.getElementById('demo-add').click();
  doc.getElementById('discount-code').value = 'KANE10';
  doc.getElementById('apply-discount').click();
  doc.getElementById('pay-button').click();
  doc.getElementById('pay-button').click(); // double-click during Processing
  timers.fns[0]();
  const rows = doc.getElementById('ledger-body').findAll((e) => e.tag === 'tr')
    .filter((tr) => tr.children[0] && tr.children[0].textContent.indexOf('LOOP-') === 0);
  assert.equal(rows.length, 1, 'patched DOM still shows 2 ledger orders');
  assert.equal(doc.getElementById('charge-flag').hidden, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('G1 strategy: "Start new order" wipes the ledger is recognised, fixed by a one-line patch, sweep P7 flips to pass', () => {
  const dir = freshWorkdir();
  const text = '{"type":"stream_start"}\n{"step":"Start a new order, then place a second order","status":"failed","remark":"After Start new order, the ledger shows only 1 order (LOOP-1002); the first order LOOP-1001 is gone."}\n{"type":"run_end","status":"failed","reason":"assertion failed","duration":50000,"credits_consumed":9}\n';
  const parsed = parseNdjson(text, 'run', 1, 50000);
  assert.equal(parsed.classification, 'APP_BUG');
  assert.equal(strategyFor(parsed), 'g1-ledger');
  const fix = dispatchFix(parsed, dir);
  assert.equal(fix.ok, true, fix.reason || '');
  assert.equal(fix.strategy, 'g1-ledger-preserve');
  assert.equal(fix.diff.length, 1, 'G1 fix touches cart.js only');
  const total = fix.diff.reduce((s, f) => s + f.added + f.removed, 0);
  assert.ok(total <= 30, 'G1 diff is ' + total + ' lines, within the 30-line contract');
  const LM = loadCart(dir);
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'mug', 1);
  LM.pay(s);
  LM.reset(s); // Start new order — the ledger must survive this
  LM.addToCart(s, 'hoodie', 1);
  LM.pay(s);
  assert.equal(s.orders.length, 2, 'both orders stay in the ledger after the G1 fix');
  assert.deepEqual(s.orders.map((o) => o.id), ['LOOP-1001', 'LOOP-1002']);
  const sweep = runSweep(path.join(dir, 'loopmart', 'cart.js'));
  assert.equal(sweep.knownIssue.pass, true, 'the sweep ledger probe flips to pass after the G1 fix');
  fs.rmSync(dir, { recursive: true, force: true });
});

check('G1 strategy: a G1 remark mentioning "2 orders" is not misrouted to double-charge', () => {
  const text = '{"type":"stream_start"}\n{"step":"Verify the ledger keeps both orders","status":"failed","remark":"Expected 2 orders in the ledger after two checkouts, found only 1 — the first order was wiped by Start new order."}\n{"type":"run_end","status":"failed","reason":"assertion failed","duration":50000,"credits_consumed":9}\n';
  const parsed = parseNdjson(text, 'run', 1, 50000);
  assert.equal(strategyFor(parsed), 'g1-ledger');
});

check('G1 fix is idempotent: a second dispatch on the patched copy finds no anchor and changes nothing', () => {
  const dir = freshWorkdir();
  const text = '{"type":"stream_start"}\n{"step":"Start a new order, then place a second order","status":"failed","remark":"After Start new order, the ledger shows only 1 order; the first order is gone."}\n{"type":"run_end","status":"failed","reason":"assertion failed","duration":50000,"credits_consumed":9}\n';
  const parsed = parseNdjson(text, 'run', 1, 50000);
  assert.equal(dispatchFix(parsed, dir).ok, true);
  const before = fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8');
  const second = dispatchFix(parsed, dir);
  assert.equal(second.ok, false);
  assert.ok(/anchor not found/.test(second.reason));
  assert.equal(fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8'), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('fixer is idempotent: a second dispatch on the patched copy finds no anchor and changes nothing', () => {
  const dir = freshWorkdir();
  assert.equal(dispatchFix(seededParsed(), dir).ok, true);
  const before = fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8');
  const second = dispatchFix(seededParsed(), dir);
  assert.equal(second.ok, false);
  assert.ok(/anchor not found/.test(second.reason));
  assert.equal(fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8'), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('unknown failure signature: no fix strategy, nothing written', () => {
  const dir = freshWorkdir();
  const text = '{"type":"stream_start"}\n{"step":"Verify totals are computed server-side","status":"failed","remark":"totals come from a wrong constant outside the allow-list"}\n{"type":"run_end","status":"failed","reason":"assertion failed","duration":50000,"credits_consumed":12}\n';
  const parsed = parseNdjson(text, 'run', 1, 50000);
  assert.equal(parsed.classification, 'APP_BUG');
  assert.equal(strategyFor(parsed), null);
  const before = fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8');
  const fix = dispatchFix(parsed, dir);
  assert.equal(fix.ok, false);
  assert.ok(/no fix strategy/.test(fix.reason));
  assert.equal(fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8'), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('rollback restores pre-patch contents byte-for-byte', () => {
  const dir = freshWorkdir();
  const fix = dispatchFix(seededParsed(), dir);
  assert.equal(fix.ok, true);
  // Roll back using the original files copied aside before patching.
  const origDir = freshWorkdir();
  const beforeList = [
    { path: 'loopmart/cart.js', content: fs.readFileSync(path.join(origDir, 'loopmart', 'cart.js'), 'utf8') },
    { path: 'loopmart/app.js', content: fs.readFileSync(path.join(origDir, 'loopmart', 'app.js'), 'utf8') },
  ];
  const rolled = rollbackFix(dir, beforeList);
  assert.deepEqual(rolled.restored, ['loopmart/cart.js', 'loopmart/app.js']);
  assert.equal(fs.readFileSync(path.join(dir, 'loopmart', 'cart.js'), 'utf8'), beforeList[0].content);
  assert.equal(fs.readFileSync(path.join(dir, 'loopmart', 'app.js'), 'utf8'), beforeList[1].content);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(origDir, { recursive: true, force: true });
});

check('fix prompt is fixed-format: failing step, remark, screenshot path, allow-list only', () => {
  const prompt = fixPromptFor(seededParsed());
  assert.deepEqual(Object.keys(prompt).sort(), ['allowListedFiles', 'failingStep', 'remark', 'screenshotPath']);
  assert.equal(prompt.failingStep, 'Verify the order ledger contains exactly one order');
  assert.deepEqual(prompt.allowListedFiles, ['loopmart/cart.js', 'loopmart/app.js']);
});

check('anti-cheat (extended): DISCOUNT_PERCENT tampering, literal totals, weakened assertions rejected', () => {
  const tampered = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 1, content: 'const DISCOUNT_PERCENT = 0;\n' }]);
  assert.equal(tampered.ok, false);
  assert.ok(tampered.violations.some((v) => /discount rate tampered/.test(v)));
  const literal = validateFix([{ path: 'loopmart/cart.js', added: 2, removed: 1, content: 'function totalPence(state) {\n  return 4500;\n}\n' }]);
  assert.equal(literal.ok, false);
  assert.ok(literal.violations.some((v) => /hard-coded/.test(v)));
  const objectLiteral = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 1, content: 'const totals = { totalPence: 4500 };\n' }]);
  assert.equal(objectLiteral.ok, false);
  const weakened = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 1, content: 'return { A1: true, A2: true, A3: true, A4: true, A5: true };\n' }]);
  assert.equal(weakened.ok, false);
  assert.ok(weakened.violations.some((v) => /assertion weakened/.test(v)));
  const deletedDiscount = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 1, content: 'discountPence = 0;\n' }]);
  assert.equal(deletedDiscount.ok, false);
  const testEdit = validateFix([{ path: 'tests/loopmart-checkout_test.md', added: 1, removed: 1, content: 'x' }]);
  assert.equal(testEdit.ok, false);
});

check('sweep catches a hard-coded total dynamically (mutation check, prep 03 §13.4)', () => {
  const dir = freshWorkdir();
  const cartPath = path.join(dir, 'loopmart', 'cart.js');
  const text = fs.readFileSync(cartPath, 'utf8');
  const cheated = text.replace(
    '  function totalPence(state) {\n    return subtotalPence(state) - discountPence(state);\n  }',
    '  function totalPence(state) {\n    return 4500; // hard-coded total\n  }',
  );
  assert.notEqual(cheated, text, 'cheat anchor must match the current cart.js');
  fs.writeFileSync(cartPath, cheated, 'utf8');
  const sweep = runSweep(cartPath);
  assert.equal(sweep.pass, false);
  const p1 = sweep.probes.find((p) => p.id === 'independent-total');
  assert.equal(p1.pass, false, 'a hard-coded £45.00 must fail the independent-total probe (£31.50 expected)');
  assert.ok(/4500|£45\.00/.test(p1.actual));
  fs.rmSync(dir, { recursive: true, force: true });
});

check('sweep on the unpatched copy fails the double-click probe; on the patched copy it passes', () => {
  const raw = freshWorkdir();
  const before = runSweep(path.join(raw, 'loopmart', 'cart.js'));
  assert.equal(before.pass, false);
  assert.equal(before.probes.find((p) => p.id === 'double-click-pay').pass, false);
  assert.equal(before.probes.find((p) => p.id === 'independent-total').pass, true);
  const dir = freshWorkdir();
  assert.equal(dispatchFix(seededParsed(), dir).ok, true);
  const after = runSweep(path.join(dir, 'loopmart', 'cart.js'));
  assert.equal(after.pass, true, 'core probes must pass after the fix');
  assert.equal(after.knownIssue.pass, false, 'G1 still fails by design and is reported separately');
  assert.ok(/G1/.test(after.knownIssue.note));
  fs.rmSync(raw, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(passed + ' fixer/sweep tests passed');

'use strict';
/**
 * Chaos sweep tests — prep 02, objective O2 (the independent second
 * check). The sweep derives the expected total itself from the catalogue
 * prices, uses different inputs from the core flow, and must fail the
 * seeded bug on an unpatched copy and pass on a patched one.
 * Run: `node kane-watch/test/run-sweep.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { runSweep, SWEEP_INPUTS } = require('../src/sweep.js');
const { dispatchFix } = require('../src/fixer.js');
const { parseNdjson } = require('../src/parse-ndjson.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

const ROOT = path.join(__dirname, '..', '..');

function freshWorkdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-sweep-'));
  // Seed from the frozen buggy fixture, not the live files: the fix has
  // shipped, so the live loopmart/ is patched (see fixtures/buggy-loopmart/README.md).
  execSync('cp -r ' + path.join(__dirname, 'fixtures', 'buggy-loopmart') + ' ' + path.join(dir, 'loopmart'));
  return dir;
}

check('sweep inputs differ from the core-flow replay inputs (independence)', () => {
  assert.notEqual(SWEEP_INPUTS, 'mug+hoodie, KANE10');
  assert.ok(SWEEP_INPUTS.includes('2x notebook'));
  assert.ok(SWEEP_INPUTS.includes('double-click'));
});

check('sweep independence: a tampered price table fails independent-total (expected prices are hardcoded from the spec, not read from the app)', () => {
  const dir = freshWorkdir();
  const cartPath = path.join(dir, 'loopmart', 'cart.js');
  const text = fs.readFileSync(cartPath, 'utf8');
  // Tamper the catalogue the app uses: Mug £15.00 -> £15.01. The app's
  // own totals move with the tamper, so a sweep that derived its
  // expected total from LM.PRODUCTS would agree with the app and pass.
  const tampered = text.replace('pricePence: 1500', 'pricePence: 1501');
  assert.notEqual(tampered, text, 'tamper anchor must match the current cart.js');
  fs.writeFileSync(cartPath, tampered, 'utf8');
  const sweep = runSweep(cartPath);
  const p1 = sweep.probes.find((p) => p.id === 'independent-total');
  assert.equal(p1.pass, false, 'a 1p price-table tamper must fail the independent-total probe');
  assert.ok(/£31\.50/.test(p1.expected), 'the expected total stays the spec £31.50');
  assert.ok(/£31\.51/.test(p1.actual), 'the app computes £31.51 from its tampered table');
  fs.rmSync(dir, { recursive: true, force: true });
});

check('sweep on the unpatched copy: independent-total passes, double-click fails, G1 fails on the frozen pre-fix fixture', () => {
  // The unpatched copy is the frozen buggy fixture: the fix has shipped,
  // so the live cart.js is patched and the sweep passes on it.
  const sweep = runSweep(path.join(__dirname, 'fixtures', 'buggy-loopmart', 'cart.js'));
  assert.equal(sweep.pass, false, 'the seeded bug must fail the sweep');
  const byId = {};
  sweep.probes.forEach((p) => { byId[p.id] = p; });
  assert.equal(byId['independent-total'].pass, true);
  assert.equal(byId['quantity-zero'].pass, true);
  assert.equal(byId['double-click-pay'].pass, false);
  assert.ok(/Fixture-only/.test(byId['double-click-pay'].note), 'P3 is labelled fixture-only');
  assert.equal(byId['negative-quantity'].pass, true);
  assert.equal(byId['discount-reuse'].pass, true);
  assert.equal(byId['refresh-mid-pay'].pass, true);
  assert.equal(byId['refresh-mid-pay'].nonProbe, true, 'P6 is a disclosed non-probe, not a check');
  assert.ok(/NON-PROBE/.test(byId['refresh-mid-pay'].note));
  assert.equal(byId['ledger-persists-across-orders'].pass, false, 'G1 fails on the frozen pre-fix fixture');
  assert.ok(/G1/.test(byId['ledger-persists-across-orders'].note));
  assert.equal(sweep.knownIssue.id, 'ledger-persists-across-orders');
});

check('sweep on the patched copy: core 5/5 pass, G1 still fails and stays excluded', () => {
  const dir = freshWorkdir();
  const SEEDED = fs.readFileSync(path.join(__dirname, 'fixtures', 'seeded-double-charge.ndjson'), 'utf8');
  const parsed = parseNdjson(SEEDED, 'run', 1, 54000);
  assert.equal(dispatchFix(parsed, dir).ok, true);
  const sweep = runSweep(path.join(dir, 'loopmart', 'cart.js'));
  assert.equal(sweep.pass, true);
  assert.equal(sweep.probes.filter((p) => p.id !== 'ledger-persists-across-orders' && !p.nonProbe).length, 5, 'core is 5 probes (P6 excluded as a non-probe)');
  assert.equal(sweep.probes.filter((p) => p.id !== 'ledger-persists-across-orders' && !p.nonProbe).every((p) => p.pass), true);
  assert.equal(sweep.knownIssue.pass, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(passed + ' chaos sweep tests passed');

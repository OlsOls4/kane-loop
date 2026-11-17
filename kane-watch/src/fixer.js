'use strict';
/**
 * Kane Loop — the fixer: a real, bounded patcher (docs/loop-design.md §4).
 *
 * The fixer is NOT trusted by prompt. It has a small library of fix
 * strategies keyed by failure signature, applies anchor replacements to
 * allow-listed files only (loopmart/cart.js, loopmart/app.js — the list
 * lives in classifier.js, imported here), and the gate enforces the fix
 * contract (validateFix) before anything is re-run. A fix that fails
 * verification is rolled back to the pre-patch contents.
 *
 * Strategies (two today — the seeded double-charge bug class and the
 * genuine defect G1):
 * - double-charge: the idempotency guard. cart.js pay() must return the
 *   existing confirmation instead of charging again, and app.js must
 *   ignore clicks while a payment is in flight. Two files, well under
 *   the 30-line / 3-file limits; no test edits, no hard-coded totals,
 *   no deletions, rollback on failure.
 * - g1-ledger: "Start new order" must not wipe the ledger. cart.js
 *   reset() preserves state.orders (and the order-number counter)
 *   across a reset, so completed orders stay visible per spec §3.4.
 *   One file, two added lines. G1 was FIXED in the shipped code 15 Nov
 *   (Wave 4 fix batch) and verified live (deploy-7 greens + the 16 Nov
 *   gate sweep ran against the G1-fixed code); the strategy remains so
 *   the loop can fix a regression the moment Kane catches one live.
 *
 * The loop IS the agent side for these bug classes: it applies a
 * validated reference patch itself (15 Nov correction — the earlier
 * wording said the gate "hands a minimal fix prompt to the coding
 * agent", but no external agent is ever invoked; the FIX PROMPT is the
 * fixed-format audit record of the failure the patch addresses).
 * A failure signature with no strategy is unfixable by this fixer:
 * dispatchFix returns { ok: false } and the gate counts the attempt
 * toward HUMAN_BLOCKED (exactly 3 attempts, then no 4th run).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateFix, ALLOW_LISTED_FILES } = require('./classifier.js');
const { runSweep } = require('./sweep.js');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

// Line counts are per replacement hunk (anchor lines removed, replacement
// lines added) — a naive whole-file prefix/suffix diff miscounts when a
// patch has two separate hunks, counting the unchanged middle as changed.
function countLines(s) { return s.split('\n').length; }

function replaceOrFail(text, anchor, replacement, where) {
  if (!text.includes(anchor)) {
    return { ok: false, reason: 'anchor not found in ' + where };
  }
  return { ok: true, text: text.replace(anchor, replacement) };
}

const CART_ANCHOR = [
  '    if (state.confirmation) {',
  "      if (state.mode === 'fixed') {",
  '        return { charged: false, order: state.confirmation, duplicate: true };',
  '      }',
  '      // Seeded bug: a second charge for the same checkout.',
  '      return { charged: true, order: chargeOnce(state), duplicate: true };',
  '    }',
].join('\n');
const CART_REPLACEMENT = [
  '    if (state.confirmation) {',
  '      // Idempotency guard: one charge per checkout, however many times',
  '      // Pay is clicked. Fixes the double-charge on double-click Pay.',
  '      return { charged: false, order: state.confirmation, duplicate: true };',
  '    }',
].join('\n');

const APP_ANCHOR = [
  '      if (state.processing) {',
  '        // Second click while the first payment is in flight.',
  '        // Buggy mode: queue a second charge (the seeded double-charge).',
  '        // Fixed mode: ignore.',
  "        if (state.mode === 'buggy') state.pendingCharges += 1;",
  '        render();',
  '        return;',
  '      }',
].join('\n');
const APP_REPLACEMENT = [
  '      if (state.processing) {',
  '        // Idempotency guard: ignore clicks while a payment is in flight.',
  '        render();',
  '        return;',
  '      }',
].join('\n');

const APP_DISABLED_ANCHOR = [
  '      payBtn.disabled = (state.processing && state.mode === \'fixed\')',
  '        || lines.length === 0;',
].join('\n');
const APP_DISABLED_REPLACEMENT = '      payBtn.disabled = state.processing || lines.length === 0;';

// G1 — "Start new order" wipes the ledger (spec §3.4: every completed
// order is appended to a visible ledger). The fix preserves the ledger
// across reset(), exactly as the order-number counter is already
// preserved. Two added lines in cart.js only.
const G1_ANCHOR_1 = [
  '    const nextOrderNo = state.nextOrderNo;',
  '    const fresh = freshState(mode);',
].join('\n');
const G1_REPLACEMENT_1 = [
  '    const nextOrderNo = state.nextOrderNo;',
  '    const orders = state.orders; // G1 fix: the ledger survives "Start new order"',
  '    const fresh = freshState(mode);',
].join('\n');
const G1_ANCHOR_2 = [
  '    state.nextOrderNo = nextOrderNo;',
  '  }',
].join('\n');
const G1_REPLACEMENT_2 = [
  '    state.nextOrderNo = nextOrderNo;',
  '    state.orders = orders; // ledger persists across orders (spec §3.4)',
  '  }',
].join('\n');

function buildG1Fix(workdir) {
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  const cartBefore = fs.readFileSync(cartPath, 'utf8');
  const step1 = replaceOrFail(cartBefore, G1_ANCHOR_1, G1_REPLACEMENT_1, 'loopmart/cart.js');
  if (!step1.ok) return { ok: false, reason: step1.reason };
  const step2 = replaceOrFail(step1.text, G1_ANCHOR_2, G1_REPLACEMENT_2, 'loopmart/cart.js');
  if (!step2.ok) return { ok: false, reason: step2.reason };
  return {
    ok: true,
    strategy: 'g1-ledger-preserve',
    diff: [
      { path: 'loopmart/cart.js', added: countLines(G1_REPLACEMENT_1) + countLines(G1_REPLACEMENT_2), removed: countLines(G1_ANCHOR_1) + countLines(G1_ANCHOR_2), content: step2.text },
    ],
    before: [
      { path: 'loopmart/cart.js', content: cartBefore },
    ],
  };
}

// Verify a G1-patched working copy behaviourally: two sequential
// checkouts in one session must both stay in the ledger (the sweep's
// P7 probe flips to pass), and the patched cart.js must load.
function verifyG1PatchedCopy(workdir) {
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  // A syntactically broken patched cart.js used to crash the watcher
  // (uncaught SyntaxError from require) — return { ok: false } so the
  // fixer rolls back instead (Wave 5, B14b).
  let LM;
  try {
    delete require.cache[require.resolve(cartPath)];
    LM = require(cartPath);
  } catch (e) {
    return { ok: false, reason: 'patched cart.js does not load: ' + e.message };
  }
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'mug', 1);
  LM.pay(s);
  LM.reset(s); // Start new order — the ledger must survive this
  LM.addToCart(s, 'hoodie', 1);
  LM.pay(s);
  if (s.orders.length !== 2) {
    return { ok: false, reason: 'ledger still wiped by Start new order: ' + s.orders.length + ' order(s) after two checkouts' };
  }
  const sweep = runSweep(cartPath);
  if (!sweep.knownIssue.pass) {
    return { ok: false, reason: 'sweep ledger probe still fails after G1 patch' };
  }
  return { ok: true, sweep: sweep };
}

function buildDoubleChargeFix(workdir) {
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  const appPath = path.join(workdir, 'loopmart', 'app.js');
  const cartBefore = fs.readFileSync(cartPath, 'utf8');
  const appBefore = fs.readFileSync(appPath, 'utf8');
  const cart = replaceOrFail(cartBefore, CART_ANCHOR, CART_REPLACEMENT, 'loopmart/cart.js');
  if (!cart.ok) return { ok: false, reason: cart.reason };
  let appText = appBefore;
  const app1 = replaceOrFail(appText, APP_ANCHOR, APP_REPLACEMENT, 'loopmart/app.js');
  if (!app1.ok) return { ok: false, reason: app1.reason };
  appText = app1.text;
  const app2 = replaceOrFail(appText, APP_DISABLED_ANCHOR, APP_DISABLED_REPLACEMENT, 'loopmart/app.js');
  if (!app2.ok) return { ok: false, reason: app2.reason };
  appText = app2.text;
  return {
    ok: true,
    strategy: 'double-charge-idempotency-guard',
    diff: [
      { path: 'loopmart/cart.js', added: countLines(CART_REPLACEMENT), removed: countLines(CART_ANCHOR), content: cart.text },
      { path: 'loopmart/app.js', added: countLines(APP_REPLACEMENT) + countLines(APP_DISABLED_REPLACEMENT), removed: countLines(APP_ANCHOR) + countLines(APP_DISABLED_ANCHOR), content: appText },
    ],
    before: [
      { path: 'loopmart/cart.js', content: cartBefore },
      { path: 'loopmart/app.js', content: appBefore },
    ],
  };
}

// Verify a patched working copy behaviourally: the double-click scenario
// must be green in BOTH modes (A1–A5 all pass), and the chaos sweep's
// core probes must pass. A syntax check on the patched app.js runs too.
function verifyPatchedCopy(workdir) {
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  // See verifyG1PatchedCopy: a broken patched cart.js must fail
  // verification (and roll back), never crash the watcher (B14b).
  let LM;
  try {
    delete require.cache[require.resolve(cartPath)];
    LM = require(cartPath);
  } catch (e) {
    return { ok: false, reason: 'patched cart.js does not load: ' + e.message };
  }
  for (const mode of ['buggy', 'fixed']) {
    const s = LM.freshState(mode);
    LM.addToCart(s, 'mug', 1);
    LM.addToCart(s, 'hoodie', 1);
    LM.applyDiscount(s, 'KANE10');
    const exp = LM.snapshotCheckout(s);
    LM.pay(s);
    LM.pay(s); // double-click: must not charge twice
    const a = LM.assertions(s, exp);
    if (s.orders.length !== 1) return { ok: false, reason: 'double-click still charges twice in ' + mode + ' mode' };
    if (!a.A1 || !a.A2 || !a.A3 || !a.A4 || !a.A5) {
      return { ok: false, reason: 'assertions fail after patch in ' + mode + ' mode: ' + JSON.stringify(a) };
    }
  }
  const sweep = runSweep(cartPath);
  if (!sweep.pass) {
    const failed = sweep.probes.filter((p) => !p.pass).map((p) => p.id).join(', ');
    return { ok: false, reason: 'chaos sweep fails after patch: ' + failed };
  }
  // Syntax-check the patched app.js (parse only, no execution).
  const appText = fs.readFileSync(path.join(workdir, 'loopmart', 'app.js'), 'utf8');
  try {
    new (require('node:vm').Script)(appText, { filename: 'loopmart/app.js' });
  } catch (e) {
    return { ok: false, reason: 'patched app.js does not parse: ' + e.message };
  }
  return { ok: true, sweep: sweep };
}

/** Restore pre-patch contents (rollback). `before` is buildDoubleChargeFix's before list. */
function rollbackFix(workdir, before) {
  for (const f of before) {
    fs.writeFileSync(path.join(workdir, f.path), f.content, 'utf8');
  }
  return { ok: true, restored: before.map((f) => f.path) };
}

/**
 * The fixed-format fix prompt: minimal, fixed fields only (docs §4).
 * No full NDJSON, no journal history — both leak prompt-injection
 * surface and tokens.
 */
function fixPromptFor(parsed) {
  return {
    failingStep: parsed.failingStep ? parsed.failingStep.step : null,
    remark: parsed.failingStep ? parsed.failingStep.remark : null,
    screenshotPath: null,
    allowListedFiles: ALLOW_LISTED_FILES.slice(),
  };
}

function strategyFor(parsed) {
  const step = (parsed.failingStep && parsed.failingStep.step) || '';
  const remark = (parsed.failingStep && parsed.failingStep.remark) || '';
  const text = (step + ' ' + remark).toLowerCase();
  // G1 first: a ledger wiped by "Start new order" is distinctive
  // (gone / wiped / lost / only the second order survives). It is
  // checked before the double-charge pattern because a G1 remark can
  // mention "2 orders" ("expected 2 orders, found 1") without any
  // double charge having happened.
  if (/start new order/.test(text) && /ledger/.test(text)) return 'g1-ledger';
  if (/ledger/.test(text) && /(wiped|gone|lost|missing|disappeared|cleared|only (the second|one) order)/.test(text)) return 'g1-ledger';
  // Double-charge: the ledger shows TWO orders FOR ONE checkout (or a
  // second charge). The "for this checkout" qualifier matters: a
  // remark that merely expects two orders is not a double charge.
  if (/ledger/.test(text) && /(2 orders for (this|one) checkout|two charges|charged twice|double.?charge)/.test(text)) return 'double-charge';
  return null;
}

const STRATEGIES = {
  'double-charge': { build: buildDoubleChargeFix, verify: verifyPatchedCopy },
  'g1-ledger': { build: buildG1Fix, verify: verifyG1PatchedCopy },
};

/**
 * Dispatch the fixer for one APP_BUG verdict.
 * Returns { ok, strategy, diff, shaBefore, shaAfter } on success, or
 * { ok: false, reason, violations?, rolledBack? } on failure. Nothing is
 * applied when the fix contract rejects the patch; a patch that fails
 * verification is applied and then rolled back.
 */
function dispatchFix(parsed, workdir) {
  const strategy = strategyFor(parsed);
  if (!strategy || !STRATEGIES[strategy]) {
    return { ok: false, strategy: null, reason: 'no fix strategy for this failure signature' };
  }
  const impl = STRATEGIES[strategy];
  const built = impl.build(workdir);
  if (!built.ok) {
    return { ok: false, strategy: strategy, reason: built.reason };
  }
  const check = validateFix(built.diff);
  if (!check.ok) {
    // Contract violation: nothing applied, nothing to roll back.
    return { ok: false, strategy: strategy, reason: 'fix rejected by contract', violations: check.violations, cheatRejected: true };
  }
  const shaBefore = {};
  for (const f of built.before) shaBefore[f.path] = sha256(f.content);
  for (const f of built.diff) {
    fs.writeFileSync(path.join(workdir, f.path), f.content, 'utf8');
  }
  const verified = impl.verify(workdir);
  if (!verified.ok) {
    const rolledBack = rollbackFix(workdir, built.before);
    return { ok: false, strategy: strategy, reason: 'verification failed: ' + verified.reason, rolledBack: rolledBack.restored };
  }
  const shaAfter = {};
  for (const f of built.diff) shaAfter[f.path] = sha256(f.content);
  return {
    ok: true, strategy: built.strategy, diff: built.diff,
    shaBefore: shaBefore, shaAfter: shaAfter, sweep: verified.sweep,
  };
}

module.exports = {
  ALLOW_LISTED_FILES: ALLOW_LISTED_FILES,
  buildDoubleChargeFix: buildDoubleChargeFix,
  buildG1Fix: buildG1Fix,
  verifyPatchedCopy: verifyPatchedCopy,
  verifyG1PatchedCopy: verifyG1PatchedCopy,
  rollbackFix: rollbackFix,
  fixPromptFor: fixPromptFor,
  strategyFor: strategyFor,
  dispatchFix: dispatchFix,
};

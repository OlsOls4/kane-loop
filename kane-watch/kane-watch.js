#!/usr/bin/env node
'use strict';
/**
 * kane-watch — the veto-gate entry point (docs/loop-design.md §1–§6).
 *
 * fs.watch on loopmart/ → createRunner (debounce + single-flight) →
 * preflight → spawnKane (real arg builder) → parseNdjson →
 * createGate.handle → appendJournal. On `fixer`, the loop applies a
 * validated reference patch for the bug class itself (the loop IS the
 * agent side — 15 Nov correction; no external agent is ever invoked)
 * and the fixed-format FIX PROMPT is emitted as the audit record of
 * the failure the patch addresses. The patch is validated with
 * validateFix, rolling back on violation.
 *
 * Live mode (`node kane-watch/kane-watch.js`, no flags) watches loopmart/
 * and runs the real gate. It refuses to start when `kane-cli whoami`
 * shows not signed in — no silent hang on auth, no live run without
 * sign-in + credits. One save-triggered run loops until a terminal
 * state: a `replay` decision re-spawns Kane to confirm, a `fixer`
 * dispatch re-spawns the replay to prove the fix, and a replay pass
 * spawns the O2 sweep via `kane run` — only replay pass AND sweep
 * pass write LOOP_VERIFIED. (15 Nov fix: the old code spawned exactly
 * one testmd replay per save and handled only the `fixer` decision, so
 * LOOP_VERIFIED was unreachable in live mode.)
 *
 * Dry-run mode (`--dry-run [fixture]`) drives the REAL wiring with the
 * seeded-bug fixture NDJSON: no Kane sign-in, no credits. Journal line,
 * fixer dispatch on the second identical red, LOOP_VERIFIED on replay +
 * sweep passes. This is the runnable demo while auth is blocked — and
 * the proof the loop closes, not just that its parts pass unit tests.
 * Every dry-run line is labelled dry-run; the verdict is computed from
 * deterministic LoopMart checks against the patched copy, never claimed
 * as a live Kane run.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { parseNdjson } = require('./src/parse-ndjson.js');
const { createGate, appendJournal, rebuildStateFromJournal } = require('./src/classifier.js');
const { createRunner, preflight, spawnKane } = require('./src/runner.js');
const { dispatchFix, fixPromptFor } = require('./src/fixer.js');
const { runSweep, SWEEP_INPUTS } = require('./src/sweep.js');

const ROOT = path.join(__dirname, '..');
const REPLAY_COMMAND = 'kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal';
const REPLAY_INPUTS = 'mug+hoodie, KANE10';
const DEFAULT_FIXTURE = path.join(ROOT, 'kane-watch', 'test', 'fixtures', 'seeded-double-charge.ndjson');

function sha256File(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file), 'utf8').digest('hex').slice(0, 16);
  } catch (e) {
    return 'no-test-file';
  }
}

function testFileHash() {
  return sha256File(path.join(ROOT, 'tests', 'objectives', 'loopmart-checkout.objective.md'));
}

function runId(seq) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + seq;
}

/** Real Kane arg builder (prep 02): the live run plugs in with zero code change. */
function buildKaneArgs(opts) {
  if (opts.command === 'testmd') {
    return ['testmd', 'run', opts.testFile, '--agent', '--headless',
      '--no-adaptive-heal', '--bug-detection', 'continue', '--timeout', '120', '--url', opts.url];
  }
  if (opts.command === 'sweep') {
    // The O2 chaos sweep is a fresh `kane run` of the O2 objective
    // (tests/objectives/loopmart-chaos-sweep.objective.md). An explicit
    // objective string overrides the file read (used by tests).
    const objective = opts.objective
      || fs.readFileSync(path.join(opts.root || ROOT, 'tests', 'objectives', 'loopmart-chaos-sweep.objective.md'), 'utf8').trim();
    return ['run', objective, '--agent', '--headless',
      '--bug-detection', 'continue', '--timeout', '120', '--url', opts.url];
  }
  return ['run', opts.objective, '--agent', '--headless',
    '--bug-detection', 'continue', '--timeout', '120', '--url', opts.url];
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Derive the replay outcome from the patched copy (not asserted): run O1 against it. */
function deriveReplayOutcome(workdir) {
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  delete require.cache[require.resolve(cartPath)];
  const LM = require(cartPath);
  const s = LM.freshState('buggy');
  LM.addToCart(s, 'mug', 1);
  LM.addToCart(s, 'hoodie', 1);
  LM.applyDiscount(s, 'KANE10');
  const exp = LM.snapshotCheckout(s);
  LM.pay(s);
  LM.pay(s); // double-click must not charge twice after the fix
  const a = LM.assertions(s, exp);
  const pass = s.orders.length === 1 && a.A1 && a.A2 && a.A3 && a.A4 && a.A5;
  return { pass: pass, orders: s.orders.length, assertions: a };
}

function synthTestmd(pass) {
  return JSON.stringify({ type: 'stream_start', run_id: 'dryrun-replay-1', synthetic: true, note: 'DRY-RUN: outcome derived from deterministic LoopMart checks against the patched copy — NOT a live Kane run' }) + '\n'
    + JSON.stringify({ type: 'test_md_done', overall_status: pass ? 'passed' : 'failed', duration_s: 18, session_id: 'dryrun-replay-1', share_url: null, credits_consumed: 0 }) + '\n';
}

function synthSweep(pass) {
  const end = { type: 'run_end', status: pass ? 'passed' : 'failed', reason: pass ? null : 'chaos sweep failed', duration: 50000, credits_consumed: 0, test_url: null, synthetic: true, note: 'DRY-RUN: outcome derived from deterministic chaos probes against the patched copy — NOT a live Kane run' };
  if (!pass) { end.result_code = 740; end.verdict = { confirmed_bug: true }; }
  return JSON.stringify({ type: 'stream_start', run_id: 'dryrun-sweep-1', synthetic: true }) + '\n' + JSON.stringify(end) + '\n';
}

function dryRun(opts) {
  const fixturePath = opts.fixture || DEFAULT_FIXTURE;
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const workdir = opts.workdir || fs.mkdtempSync(path.join(os.tmpdir(), 'kane-watch-dry-'));
  // The dry-run demonstrates fail -> patch -> green on the SEEDED bug,
  // so it seeds its working copy from the frozen buggy fixture, not the
  // live files: the fix has shipped, so the live loopmart/ is patched
  // and the fixer's anchors no longer match it (see
  // kane-watch/test/fixtures/buggy-loopmart/README.md). The dry-run is
  // a synthetic demo path — its NDJSON input already comes from a test
  // fixture, and this keeps the acceptance command working after the fix.
  copyDir(path.join(ROOT, 'kane-watch', 'test', 'fixtures', 'buggy-loopmart'), path.join(workdir, 'loopmart'));
  const hash = testFileHash();
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: hash });
  const journalPath = opts.journal || path.join(ROOT, 'journal.jsonl');
  const trace = [];
  let seq = 0;
  function log(entry) {
    seq += 1;
    entry.runId = entry.runId || runId(seq);
    appendJournal(journalPath, entry);
    trace.push(entry.runId + ' ' + (entry.classification || '') + ' -> ' + (entry.decision || '') + ' [' + (entry.verdict || '') + ']');
    return entry;
  }

  // 1. First red on the seeded bug (fixture NDJSON, exit 1, result_code 740).
  // Credits are the PARSED fixture value (14), never a hardcoded 0:
  // the journal must record what the run reported.
  let parsed = parseNdjson(fixtureText, 'run', 1, 54000);
  let h = gate.handle(parsed, { kind: 'run' });
  log({ trigger: 'dry-run', classification: parsed.classification, decision: h.decision.action, signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, exitCode: 1, terminalEvent: 'run_end', status: 'failed', creditsConsumed: parsed.creditsConsumed, verdict: h.state, notes: 'dry-run: seeded double-charge fixture; first red, confirm-before-fix replay' });

  // 2. Confirm replay: the same red again (same step — the signature
  //    hashes the step, not the remark, so a reworded remark still matches).
  parsed = parseNdjson(fixtureText, 'run', 1, 54000);
  h = gate.handle(parsed, { kind: 'run' });
  log({ trigger: 'dry-run', classification: parsed.classification, decision: h.decision.action, signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, exitCode: 1, terminalEvent: 'run_end', status: 'failed', creditsConsumed: parsed.creditsConsumed, verdict: h.state, notes: 'dry-run: second identical red, fixer dispatched' });
  if (h.decision.action !== 'fixer') {
    console.log(trace.join('\n'));
    console.log('DRY-RUN FAILED: expected a fixer dispatch, got ' + h.decision.action);
    return 1;
  }

  // 3. Fixer: emit the fixed-format prompt (audit record — the loop
  //    applies the patch itself; nothing is sent to an external agent),
  //    then apply the bounded patch.
  console.log('FIX PROMPT (audit record — applied by the loop itself, not sent to an external agent): ' + JSON.stringify(fixPromptFor(parsed)));
  const fix = dispatchFix(parsed, workdir);
  if (!fix.ok) {
    log({ trigger: 'dry-run', classification: 'APP_BUG', decision: 'fixer-failed', signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, verdict: gate.state, notes: 'dry-run: fixer failed: ' + fix.reason });
    console.log(trace.join('\n'));
    console.log('DRY-RUN FAILED: fixer: ' + fix.reason);
    if (fix.violations) console.log('violations: ' + fix.violations.join('; '));
    return 1;
  }
  log({ trigger: 'dry-run', classification: 'APP_BUG', decision: 'fixer', signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, shaBefore: fix.shaBefore['loopmart/cart.js'], shaAfter: fix.shaAfter['loopmart/cart.js'], verdict: gate.state, notes: 'dry-run: fix applied: ' + fix.strategy + ' (2 files, within the 30-line contract)' });

  // 4. Replay after the fix: outcome derived from the patched copy.
  //    The synthetic replay consumed no credits (parsed value 0).
  const replay = deriveReplayOutcome(workdir);
  parsed = parseNdjson(synthTestmd(replay.pass), 'testmd', replay.pass ? 0 : 1, 18000);
  h = gate.handle(parsed, { kind: 'replay', command: REPLAY_COMMAND, runId: 'dryrun-replay-1', testFileHash: hash, inputs: REPLAY_INPUTS });
  log({ trigger: 'dry-run', classification: parsed.classification, decision: 'replay', signature: h.signature, exitCode: replay.pass ? 0 : 1, terminalEvent: 'test_md_done', status: replay.pass ? 'passed' : 'failed', creditsConsumed: parsed.creditsConsumed, verdict: h.state, passKind: 'replay', passRunId: 'dryrun-replay-1', testFileHash: hash, inputs: REPLAY_INPUTS, notes: 'dry-run: replay outcome derived from patched copy (orders=' + replay.orders + ', A1-A5=' + JSON.stringify(replay.assertions) + ')' });

  // 5. Independent sweep against the patched copy (different inputs).
  //    Synthetic sweep, no credits consumed (parsed value 0).
  const sweep = runSweep(path.join(workdir, 'loopmart', 'cart.js'));
  parsed = parseNdjson(synthSweep(sweep.pass), 'run', sweep.pass ? 0 : 1, 50000);
  h = gate.handle(parsed, { kind: 'sweep', runId: 'dryrun-sweep-1', inputs: SWEEP_INPUTS });
  log({ trigger: 'dry-run', classification: parsed.classification, decision: 'sweep', exitCode: sweep.pass ? 0 : 1, terminalEvent: 'run_end', status: sweep.pass ? 'passed' : 'failed', creditsConsumed: parsed.creditsConsumed, verdict: h.state, passKind: 'sweep', passRunId: 'dryrun-sweep-1', inputs: SWEEP_INPUTS, notes: 'dry-run: chaos sweep ' + (sweep.pass ? 'passed (core 6/6 probes)' : 'FAILED') + '; known-issue G1 excluded from the pass' });

  // Persist: state.json is derived from the journal, never the source of truth.
  const persisted = rebuildStateFromJournal(journalPath);
  fs.writeFileSync(opts.state || path.join(ROOT, 'state.json'), JSON.stringify({ mode: 'dry-run', derivedFrom: 'journal.jsonl', ...persisted }, null, 2) + '\n', 'utf8');
  writeConsoleData(opts.consoleData || path.join(ROOT, 'loopmart', 'console-data.json'), journalPath, fix);
  console.log(trace.join('\n'));
  console.log('DRY-RUN ' + h.state + ' — fail -> patch -> green (replay + independent sweep). Workdir: ' + workdir);
  if (h.lastPassRejected) console.log('pass rejected: ' + JSON.stringify(h.lastPassRejected));
  return h.state === 'LOOP_VERIFIED' ? 0 : 1;
}

function writeConsoleData(outPath, journalPath, fix) {
  let entries = [];
  try {
    entries = fs.readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (e) { /* no journal yet */ }
  const runs = entries.slice(-5).reverse().map((e) => ({
    run_id: e.run_id, trigger: e.trigger, kind: e.trigger === 'dry-run' ? 'DRY-RUN' : 'LIVE',
    classifier: e.classifier, decision: e.decision, status: e.status,
    exit_code: e.exit_code, verdict: e.verdict, notes: e.notes || null,
  }));
  const data = {
    generated: new Date().toISOString(),
    mode: 'dry-run',
    verdict: 'EXAMPLE',
    credits: { spent: 0, balance: null, note: '0 credits — no live runs yet. Balance unknown — kane-cli balance not run.' },
    exampleRun: {
      run_id: 'EXAMPLE-001', trigger: 'seeded example', verdict: 'EXAMPLE',
      failingStep: 'Verify the order ledger contains exactly one order',
      failingStepLabel: 'the ledger check failed',
      remark: 'Ledger shows 2 orders for this checkout (LOOP-1001 and LOOP-1002); stock for Loop Mug is 8 (expected 9) and for Debug Hoodie is 8 (expected 9). The checkout was charged twice.',
      exitCode: null, credits: null,
      note: 'EXAMPLE RUN — seeded, not live. Press Break it to attempt a live run.',
    },
    runs: runs,
    fixDiff: fix ? [
      'loopmart/cart.js — pay(): if a confirmation exists, return it; never charge twice.',
      'loopmart/app.js — onPayClick(): ignore clicks while Processing.',
      'loopmart/app.js — Pay button disabled while Processing.',
    ] : [],
    fixtureNote: 'FIXTURE — synthetic, not a live run.',
  };
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * One save-triggered live loop run. Loops until a terminal state:
 *   - `replay` decision -> re-spawn Kane to confirm (confirm-before-fix);
 *   - `fixer` decision  -> dispatch the fix, then re-spawn the replay
 *     to prove it (replay-first, docs §6–§7);
 *   - replay PASS       -> spawn the O2 sweep via `kane run`;
 *   - sweep PASS        -> LOOP_VERIFIED (replay + independent pass);
 *   - setup / test-fix / human-blocked / CHEAT_REJECTED -> stop.
 * A sweep failure routes like any red (replay/fixer), so a bug the
 * sweep catches is confirmed and fixed the same way. The loop is
 * bounded by the gate's own caps (replay cap 2, per-signature 3,
 * per-claim 5) plus a hard cap on Kane spawns per save-triggered run.
 *
 * `opts`: { gate, journalPath, root, url, testFileHash,
 *   preflight, spawnKane, sweepMode ('kane' | 'local'), maxSpawns }.
 * `preflight` / `spawnKane` are injectable so the live loop is testable
 * with a mocked Kane (kane-watch/test/run-live-loop.cjs) — no sign-in,
 * no credits, no real run. When `sweepMode` is 'local', the sweep runs
 * the local deterministic probes (runSweep) instead of a `kane run`
 * and the journal labels the pass LOCAL-SWEEP, never as a Kane run.
 * `done(result)` is called once, with { state, capped? }.
 */
function runLiveGate(opts, done) {
  const o = opts || {};
  const gate = o.gate;
  const journalPath = o.journalPath || path.join(ROOT, 'journal.jsonl');
  const root = o.root || ROOT;
  const url = o.url || 'http://localhost:8080';
  const spawnFn = o.spawnKane || spawnKane;
  const preflightFn = o.preflight || preflight;
  const sweepMode = o.sweepMode || 'kane';
  const maxSpawns = o.maxSpawns || 12;
  const hash = o.testFileHash
    || sha256File(path.join(root, 'tests', 'objectives', 'loopmart-checkout.objective.md'));
  let seq = 0;
  let spawns = 0;
  let lastWasReplayPass = false;

  function journal(entry) {
    seq += 1;
    entry.runId = entry.runId || runId(seq);
    appendJournal(journalPath, entry);
    return entry;
  }

  function isTerminal() {
    return gate.state === 'LOOP_VERIFIED' || gate.state === 'HUMAN_BLOCKED'
      || gate.state === 'CHEAT_REJECTED';
  }

  function iterate() {
    if (isTerminal()) { done({ state: gate.state }); return; }
    if (spawns >= maxSpawns) {
      // Gate caps should have terminated the loop first; this is the
      // backstop so a save can never spin Kane forever.
      console.log('live loop stopped: spawn cap reached (' + maxSpawns + ' Kane runs) without a terminal state [' + gate.state + ']');
      done({ state: gate.state, capped: true });
      return;
    }
    if (lastWasReplayPass && !gate.independentPass) spawnSweep(iterate);
    else spawnReplay(iterate);
  }

  function spawnReplay(next) {
    spawns += 1;
    const rid = 'live-' + Date.now() + '-' + spawns;
    const args = buildKaneArgs({ command: 'testmd', testFile: 'tests/loopmart-checkout_test.md', url: url });
    spawnFn({ args: args }, (res) => {
      const parsed = parseNdjson(res.stdout, 'testmd', res.exitCode, res.durationMs);
      const h = gate.handle(parsed, { kind: 'replay', command: REPLAY_COMMAND, runId: rid, testFileHash: hash, inputs: REPLAY_INPUTS });
      // A pass journals as a 'replay' run (the run kind), like dry-run —
      // but only when the gate ACCEPTED the pass (provenance); a
      // rejected pass (e.g. changed test hash) is not a replay pass.
      const replayAccepted = parsed.classification === 'PASS' && h.replayPass && h.replayPass.runId === rid;
      const decision = replayAccepted ? 'replay' : h.decision.action;
      journal({ trigger: 'save', classification: parsed.classification, decision: decision, signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, exitCode: res.exitCode, terminalEvent: parsed.terminalEvent, status: parsed.status, creditsConsumed: parsed.creditsConsumed, durationMs: res.durationMs, testUrl: parsed.testUrl, verdict: h.state, passKind: replayAccepted ? 'replay' : null, passRunId: replayAccepted ? rid : null, testFileHash: hash, inputs: REPLAY_INPUTS, notes: 'live testmd replay' + (parsed.classification === 'PASS' && !replayAccepted ? ' — pass REJECTED by gate: ' + (h.lastPassRejected ? h.lastPassRejected.reason : 'provenance') : '') });
      console.log('run -> ' + parsed.classification + ' -> ' + h.decision.action + ' [' + h.state + ']');
      if (h.decision.action === 'fixer') {
        lastWasReplayPass = false;
        console.log('FIX PROMPT (audit record — applied by the loop itself, not sent to an external agent): ' + JSON.stringify(fixPromptFor(parsed)));
        const fix = dispatchFix(parsed, root);
        if (!fix.ok && fix.cheatRejected) {
          gate.state = 'CHEAT_REJECTED';
          journal({ trigger: 'save', classification: 'APP_BUG', decision: 'fixer', verdict: 'CHEAT_REJECTED', notes: 'fix rejected by contract: ' + (fix.violations || []).join('; ') });
          console.log('CHEAT_REJECTED: ' + (fix.violations || []).join('; '));
          done({ state: gate.state });
          return;
        }
        if (!fix.ok) {
          journal({ trigger: 'save', classification: 'APP_BUG', decision: 'fixer', verdict: gate.state, notes: 'live: fixer failed: ' + fix.reason + (fix.rolledBack ? ' (rolled back)' : '') });
          console.log('fixer failed: ' + fix.reason + (fix.rolledBack ? ' (rolled back)' : ''));
        } else {
          journal({ trigger: 'save', classification: 'APP_BUG', decision: 'fixer', verdict: gate.state, shaBefore: fix.shaBefore['loopmart/cart.js'], shaAfter: fix.shaAfter['loopmart/cart.js'], notes: 'live: fix applied: ' + fix.strategy });
          console.log('fix applied: ' + fix.strategy);
        }
        next();
        return;
      }
      if (h.decision.action === 'replay') { lastWasReplayPass = false; next(); return; }
      if (h.decision.action === 'none' && parsed.classification === 'PASS') {
        // A pass the gate REJECTED (provenance — e.g. changed test
        // hash, healed test suspected) is not a replay pass: do not
        // spend a sweep on it; stop for a human to look.
        if (!replayAccepted) {
          console.log('replay pass REJECTED by the gate: ' + (h.lastPassRejected ? h.lastPassRejected.reason : 'provenance') + ' — stopping for a human');
          done({ state: gate.state });
          return;
        }
        lastWasReplayPass = true;
        next();
        return;
      }
      // setup / test-fix / human-blocked: stop this save-triggered run.
      done({ state: gate.state });
    });
  }

  function spawnSweep(next) {
    if (sweepMode === 'local') {
      // No Kane spawn: the local deterministic probes, labelled
      // LOCAL-SWEEP in the journal — never presented as a Kane run.
      const sweep = runSweep(path.join(root, 'loopmart', 'cart.js'));
      const rid = 'local-sweep-' + Date.now() + '-' + seq;
      const parsed = parseNdjson(synthSweep(sweep.pass), 'run', sweep.pass ? 0 : 1, 50000);
      const h = gate.handle(parsed, { kind: 'sweep', runId: rid, inputs: SWEEP_INPUTS });
      const accepted = parsed.classification === 'PASS' && h.independentPass && h.independentPass.runId === rid;
      const decision = accepted ? 'sweep' : h.decision.action;
      journal({ trigger: 'save', classification: parsed.classification, decision: decision, exitCode: sweep.pass ? 0 : 1, terminalEvent: 'run_end', status: sweep.pass ? 'passed' : 'failed', creditsConsumed: parsed.creditsConsumed, verdict: h.state, passKind: accepted ? 'sweep' : null, passRunId: accepted ? rid : null, inputs: SWEEP_INPUTS, notes: 'LOCAL-SWEEP — local deterministic probes (core ' + (sweep.pass ? '6/6' : 'FAILED') + '), NOT a Kane run; known-issue G1 excluded' });
      console.log('sweep (local) -> ' + parsed.classification + ' -> ' + h.decision.action + ' [' + h.state + ']');
      lastWasReplayPass = false;
      if (h.state === 'LOOP_VERIFIED') { done({ state: h.state }); return; }
      if (h.decision.action === 'replay' || h.decision.action === 'fixer') { next(); return; }
      done({ state: gate.state });
      return;
    }
    spawns += 1;
    const rid = 'live-sweep-' + Date.now() + '-' + spawns;
    const args = buildKaneArgs({ command: 'sweep', url: url, root: root });
    spawnFn({ args: args }, (res) => {
      const parsed = parseNdjson(res.stdout, 'run', res.exitCode, res.durationMs);
      const h = gate.handle(parsed, { kind: 'sweep', runId: rid, inputs: SWEEP_INPUTS });
      const accepted = parsed.classification === 'PASS' && h.independentPass && h.independentPass.runId === rid;
      const decision = accepted ? 'sweep' : h.decision.action;
      journal({ trigger: 'save', classification: parsed.classification, decision: decision, signature: h.signature, attemptNo: h.attemptsBySignature, attemptsPerClaim: h.attemptsPerClaim, exitCode: res.exitCode, terminalEvent: parsed.terminalEvent, status: parsed.status, creditsConsumed: parsed.creditsConsumed, durationMs: res.durationMs, testUrl: parsed.testUrl, verdict: h.state, passKind: accepted ? 'sweep' : null, passRunId: accepted ? rid : null, inputs: SWEEP_INPUTS, notes: 'live O2 chaos sweep (kane run)' });
      console.log('sweep -> ' + parsed.classification + ' -> ' + h.decision.action + ' [' + h.state + ']');
      lastWasReplayPass = false;
      if (h.state === 'LOOP_VERIFIED') { done({ state: h.state }); return; }
      // A sweep red routes like any red: confirm with the replay, then fix.
      if (h.decision.action === 'replay' || h.decision.action === 'fixer') { next(); return; }
      done({ state: gate.state });
    });
  }

  preflightFn((pf) => {
    if (!pf.signedIn) {
      journal({ trigger: 'save', classification: 'DIDNT_START', decision: 'setup', exitCode: 2, verdict: gate.state, notes: 'DID NOT START — kane-cli not signed in: ' + pf.whoami });
      console.log('DID NOT START — exit 2 — kane-cli not signed in. Sign in, then save again.');
      done({ state: gate.state, started: false });
      return;
    }
    iterate();
  });
}

function watch(opts) {
  const url = opts.url || 'http://localhost:8080';
  const journalPath = opts.journal || path.join(ROOT, 'journal.jsonl');
  const hash = testFileHash();
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: hash });
  const restored = rebuildStateFromJournal(journalPath);
  gate.attemptsBySignature = restored.attemptsBySignature;
  gate.attemptsPerClaim = restored.attemptsPerClaim;
  gate.pendingReds = new Set(restored.pendingReds);
  if (restored.replayPass) gate.replayPass = restored.replayPass;
  if (restored.independentPass) gate.independentPass = restored.independentPass;

  const runner = createRunner((done) => {
    runLiveGate({ gate: gate, journalPath: journalPath, root: ROOT, url: url, testFileHash: hash }, () => done());
  }, {});
  fs.watch(path.join(ROOT, 'loopmart'), { recursive: true }, (event, filename) => {
    if (filename) runner.save('loopmart/' + filename);
  });
  console.log('kane-watch watching loopmart/ (target ' + url + '). Save a file to run the gate. Ctrl-C to stop.');
}

function printHelp() {
  console.log([
    'kane-watch — a veto gate for AI coding agents, built around Kane CLI.',
    '',
    'Usage:',
    '  kane-watch --dry-run [fixture]   drive the real loop wiring with a fixture NDJSON stream (no sign-in, no credits)',
    '  kane-watch                       watch loopmart/ and run the live gate on save (needs kane-cli sign-in + credits)',
    '  kane-watch --help                this help',
    '',
    'Options:',
    '  --workdir <dir>   working copy for the fixer (dry-run default: a temp dir)',
    '  --journal <path>  journal file (default: journal.jsonl)',
    '  --url <url>       LoopMart URL for live runs (default: http://localhost:8080)',
    '',
    'Dry-run acceptance: node kane-watch/kane-watch.js --dry-run',
    '  kane-watch/test/fixtures/seeded-double-charge.ndjson',
    'closes the loop end-to-end: fail -> patch -> green (replay + sweep).',
  ].join('\n'));
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { printHelp(); return 0; }
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      opts.dryRun = true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) opts.fixture = args[i + 1];
    }
    if (args[i] === '--workdir') opts.workdir = args[i + 1];
    if (args[i] === '--journal') opts.journal = args[i + 1];
    if (args[i] === '--url') opts.url = args[i + 1];
  }
  if (opts.dryRun) return dryRun(opts);
  watch(opts);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { buildKaneArgs: buildKaneArgs, dryRun: dryRun, runLiveGate: runLiveGate, REPLAY_COMMAND: REPLAY_COMMAND, REPLAY_INPUTS: REPLAY_INPUTS, SWEEP_INPUTS: SWEEP_INPUTS };

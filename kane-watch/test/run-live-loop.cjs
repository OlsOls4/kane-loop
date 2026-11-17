'use strict';
/**
 * Live-loop test — the HIGH defect from the fresh re-score (15 Nov):
 * runLiveGate used to spawn exactly one testmd replay per save and
 * handle only the `fixer` decision, so LOOP_VERIFIED was unreachable
 * in live mode (no re-spawn on `replay`, no O2 sweep ever spawned).
 * This test drives runLiveGate with a mocked spawnKane from the first
 * red to LOOP_VERIFIED, without dryRun() and without a live Kane run.
 * Run: `node kane-watch/test/run-live-loop.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { createGate } = require('../src/classifier.js');
const { buildKaneArgs, runLiveGate, REPLAY_COMMAND, REPLAY_INPUTS, SWEEP_INPUTS } = require('../kane-watch.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

const ROOT = path.join(__dirname, '..', '..');

// A realistic failing testmd replay: a real `testmd run` terminates on
// test_md_done (not run_end), with the failing step inline. Feeding the
// `kane run` fixture to a testmd spawn would (correctly) classify
// INCONCLUSIVE — wrong terminal for the command — so the red replays
// are synthesised in testmd shape, with the same failing step and
// remark as the seeded-bug fixture (credits 14, as the fixture says).
function redTestmd(runId) {
  return JSON.stringify({ type: 'stream_start', run_id: runId, synthetic: true, note: 'MOCKED live replay — scripted red testmd, not a real Kane run' }) + '\n'
    + JSON.stringify({ step: 'Verify the order ledger contains exactly one order', status: 'failed', remark: 'Ledger shows 2 orders for this checkout (LOOP-1001 and LOOP-1002); stock for Loop Mug is 8 (expected 9) and for Debug Hoodie is 8 (expected 9). The checkout was charged twice.' }) + '\n'
    + JSON.stringify({ type: 'test_md_done', overall_status: 'failed', duration_s: 54, session_id: runId, share_url: null, credits_consumed: 14 }) + '\n';
}

function freshRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-live-loop-'));
  // Seed from the frozen buggy fixture, not the live files: the fix has
  // shipped, so the live loopmart/ is patched (see fixtures/buggy-loopmart/README.md).
  execSync('cp -r ' + path.join(__dirname, 'fixtures', 'buggy-loopmart') + ' ' + path.join(dir, 'loopmart'));
  execSync('mkdir -p ' + path.join(dir, 'tests', 'objectives'));
  execSync('cp ' + path.join(ROOT, 'tests', 'objectives', 'loopmart-checkout.objective.md') + ' ' + path.join(dir, 'tests', 'objectives', 'loopmart-checkout.objective.md'));
  execSync('cp ' + path.join(ROOT, 'tests', 'objectives', 'loopmart-chaos-sweep.objective.md') + ' ' + path.join(dir, 'tests', 'objectives', 'loopmart-chaos-sweep.objective.md'));
  // The _test.md the replay actually executes (Wave 4 fix): runLiveGate
  // hashes it as the fallback testFileHash, so the temp root needs it.
  // Re-wired -6 -> -8 on 16 Nov 2026: -6 fails Kane's replay analyzer at
  // step 18 (5x, Kane-side); -8 replays clean. The two files are
  // byte-identical (same sha256), so only the name matters.
  execSync('mkdir -p ' + path.join(dir, '.testmuai', 'tests'));
  execSync('cp ' + path.join(ROOT, '.testmuai', 'tests', 'loopmart-o1-core-8_test.md') + ' ' + path.join(dir, '.testmuai', 'tests', 'loopmart-o1-core-8_test.md'));
  return dir;
}

function greenTestmd(runId) {
  return JSON.stringify({ type: 'stream_start', run_id: runId, synthetic: true, note: 'MOCKED live replay — scripted green testmd, not a real Kane run' }) + '\n'
    + JSON.stringify({ type: 'test_md_done', overall_status: 'passed', duration_s: 18, session_id: runId, share_url: null, credits_consumed: 0 }) + '\n';
}

// Analyzer failure, mirroring the real -6 replay evidence
// (evidence/o1-green-replay-3rd-2026-11-15.ndjson): test_md_done failed,
// no verdict, no failing step event — the run_end reason is
// "analyzer_failed: @ step 18" but run_end is not the terminal for a
// testmd command. Classifies DIDNT_START with a terminal event.
function analyzerTestmd(runId) {
  return JSON.stringify({ type: 'stream_start', run_id: runId, synthetic: true, note: 'MOCKED analyzer failure — mirrors the real -6 replay evidence, not a real Kane run' }) + '\n'
    + JSON.stringify({ type: 'step_end', index: 18, status: 'failed', summary: 'analyze: Reading the displayed total from the cart summary' }) + '\n'
    + JSON.stringify({ type: 'run_end', run_id: 'run-0', status: 'failed', reason: 'analyzer_failed: @ step 18' }) + '\n'
    + JSON.stringify({ type: 'test_md_step_end', step_index: 1, status: 'failed' }) + '\n'
    + JSON.stringify({ type: 'test_md_done', overall_status: 'failed', duration_s: 23, session_id: runId }) + '\n';
}

function greenSweep(runId) {
  return JSON.stringify({ type: 'stream_start', run_id: runId, synthetic: true, note: 'MOCKED live sweep — scripted green run_end, not a real Kane run' }) + '\n'
    + JSON.stringify({ type: 'run_end', status: 'passed', reason: null, duration: 50000, credits_consumed: 7, test_url: null, synthetic: true }) + '\n';
}

function mockPreflight(cb) {
  cb({ signedIn: true, whoami: 'mock-user (test)' });
}

// Mocked live checks (Wave 4 fix): the real ones shell out to
// `kane-cli balance` and curl — never run in a unit test.
function mockLiveChecksOk(o, cb) {
  cb({ ok: true, balance: 9723, reason: 'mocked live checks OK' });
}

// Scripted Kane: first two testmd replays are the seeded red, the third
// is green; the sweep (kane run) is green.
function scriptedSpawnKane(calls) {
  let testmdCalls = 0;
  return function mockSpawnKane(opts, done) {
    calls.push(opts.args.slice());
    if (opts.args[0] === 'testmd') {
      testmdCalls += 1;
      if (testmdCalls <= 2) {
        done({ exitCode: 1, stdout: redTestmd('live-replay-' + testmdCalls), stderr: '', durationMs: 54000, timedOut: false });
      } else {
        done({ exitCode: 0, stdout: greenTestmd('live-replay-' + testmdCalls), stderr: '', durationMs: 18000, timedOut: false });
      }
      return;
    }
    done({ exitCode: 0, stdout: greenSweep('live-sweep-1'), stderr: '', durationMs: 50000, timedOut: false });
  };
}

function loadCart(workdir) {
  const p = path.join(workdir, 'loopmart', 'cart.js');
  delete require.cache[require.resolve(p)];
  return require(p);
}

check('buildKaneArgs sweep branch builds the O2 kane-run command from the objective file', () => {
  const args = buildKaneArgs({ command: 'sweep', url: 'http://localhost:8080', root: ROOT });
  assert.equal(args[0], 'run');
  assert.ok(args[1].length > 100, 'the O2 objective text is the run argument');
  assert.ok(/chaos/i.test(args[1]), 'the objective is the chaos sweep, not O1');
  assert.ok(args.includes('--agent') && args.includes('--headless'));
  assert.ok(args.includes('--bug-detection') && args.includes('continue'));
  assert.ok(args.includes('--timeout') && args.includes('300'), 'the sweep timeout is 300 s — the measured O2 sweep took 180.5 s, over the old 120 s cap');
  assert.ok(args.includes('--url') && args.includes('http://localhost:8080'));
  // No --no-adaptive-heal on a fresh kane run (that flag is testmd-only).
  assert.ok(!args.includes('--no-adaptive-heal'));
});

check('live loop closes with mocked spawnKane: red -> replay -> fixer -> replay -> sweep -> LOOP_VERIFIED', () => {
  const dir = freshRoot();
  const journal = path.join(dir, 'journal.jsonl');
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: null });
  const calls = [];
  let result = null;
  runLiveGate({
    gate: gate, journalPath: journal, root: dir, url: 'http://localhost:8080',
    preflight: mockPreflight, liveChecks: mockLiveChecksOk,
    spawnKane: scriptedSpawnKane(calls),
  }, (r) => { result = r; });
  assert.ok(result, 'done() must be called');
  assert.equal(result.state, 'LOOP_VERIFIED', 'live loop must reach LOOP_VERIFIED');
  assert.equal(result.capped, undefined, 'must not hit the spawn cap');
  assert.equal(calls.length, 4, 'exactly 4 Kane spawns: 3 testmd replays + 1 sweep run');
  assert.deepEqual(calls.map((c) => c[0]), ['testmd', 'testmd', 'testmd', 'run']);
  assert.deepEqual(calls[2].slice(0, 4), ['testmd', 'run', '.testmuai/tests/loopmart-o1-core-8_test.md', '--agent'], 'the replay replays the committed _test.md (Wave 4 fix: tests/loopmart-checkout_test.md never existed; re-wired -6 -> -8 on 16 Nov 2026 because -6 fails Kane\'s replay analyzer at step 18, 5x)');
  assert.ok(calls[2].includes('--no-adaptive-heal'), 'the confirm replay keeps --no-adaptive-heal');
  assert.ok(calls[3].includes('--bug-detection') && calls[3].includes('continue'), 'the sweep is a kane run with bug detection');

  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 5, 'five journal lines: red, confirm, fix, replay, sweep');
  assert.deepEqual(lines.map((l) => l.decision), ['replay', 'fixer', 'fixer', 'replay', 'sweep']);
  assert.equal(lines[0].classifier, 'APP_BUG');
  assert.equal(lines[0].credits_consumed, 14, 'the red lines record the parsed fixture credits (14), not a hardcoded 0');
  assert.equal(lines[1].credits_consumed, 14);
  assert.equal(lines[3].pass_kind, 'replay');
  assert.equal(lines[4].pass_kind, 'sweep');
  assert.equal(lines[4].verdict, 'LOOP_VERIFIED');
  assert.notEqual(lines[4].pass_run_id, lines[3].pass_run_id, 'sweep is a different run from the replay');
  assert.notEqual(lines[4].inputs, lines[3].inputs, 'sweep inputs differ from replay inputs');
  assert.equal(lines[4].notes, 'live O2 chaos sweep (kane run)');
  assert.ok(gate.replayPass && gate.independentPass, 'gate holds both passes');

  // The fix was really applied to the working copy: double-click is one order.
  const LM = loadCart(dir);
  const s = LM.freshState('buggy');
  LM.addToCart(s, 'mug', 1);
  LM.addToCart(s, 'hoodie', 1);
  LM.applyDiscount(s, 'KANE10');
  LM.pay(s);
  LM.pay(s);
  assert.equal(s.orders.length, 1, 'live-loop working copy still double-charges');
  fs.rmSync(dir, { recursive: true, force: true });
});

// Scripted Kane: the first testmd replay fails on the analyzer (the -6
// shape, DIDNT_START with a terminal event), the second is green; the
// sweep (kane run) is green. B14a: the analyzer failure must re-spawn
// once and still reach LOOP_VERIFIED, not stop the loop on setup.
function scriptedSpawnKaneAnalyzerFirst(calls) {
  let testmdCalls = 0;
  return function mockSpawnKane(opts, done) {
    calls.push(opts.args.slice());
    if (opts.args[0] === 'testmd') {
      testmdCalls += 1;
      if (testmdCalls === 1) {
        done({ exitCode: 1, stdout: analyzerTestmd('live-replay-an-1'), stderr: '', durationMs: 23000, timedOut: false });
      } else {
        done({ exitCode: 0, stdout: greenTestmd('live-replay-' + testmdCalls), stderr: '', durationMs: 18000, timedOut: false });
      }
      return;
    }
    done({ exitCode: 0, stdout: greenSweep('live-sweep-1'), stderr: '', durationMs: 50000, timedOut: false });
  };
}

check('analyzer failure on the first replay re-spawns once and still reaches LOOP_VERIFIED', () => {
  const dir = freshRoot();
  const journal = path.join(dir, 'journal.jsonl');
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: null });
  const calls = [];
  let result = null;
  runLiveGate({
    gate: gate, journalPath: journal, root: dir, url: 'http://localhost:8080',
    preflight: mockPreflight, liveChecks: mockLiveChecksOk,
    spawnKane: scriptedSpawnKaneAnalyzerFirst(calls),
  }, (r) => { result = r; });
  assert.ok(result, 'done() must be called');
  assert.equal(result.state, 'LOOP_VERIFIED', 'one analyzer failure must not stop the loop');
  assert.equal(result.capped, undefined, 'must not hit the spawn cap');
  assert.equal(calls.length, 3, 'exactly 3 Kane spawns: analyzer-failed replay + green replay + sweep');
  assert.deepEqual(calls.map((c) => c[0]), ['testmd', 'testmd', 'run']);
  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 3, 'three journal lines: analyzer failure, replay pass, sweep pass');
  assert.equal(lines[0].classifier, 'DIDNT_START');
  assert.equal(lines[0].decision, 'replay');
  assert.equal(lines[1].pass_kind, 'replay');
  assert.equal(lines[2].pass_kind, 'sweep');
  assert.equal(lines[2].verdict, 'LOOP_VERIFIED');
  assert.ok(gate.replayPass && gate.independentPass, 'gate holds both passes');
  fs.rmSync(dir, { recursive: true, force: true });
});

check('live loop with sweepMode local: LOCAL-SWEEP closes the loop and is never labelled a Kane run', () => {
  const dir = freshRoot();
  const journal = path.join(dir, 'journal.jsonl');
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: null });
  const calls = [];
  let result = null;
  runLiveGate({
    gate: gate, journalPath: journal, root: dir, url: 'http://localhost:8080',
    preflight: mockPreflight, liveChecks: mockLiveChecksOk,
    spawnKane: scriptedSpawnKane(calls), sweepMode: 'local',
  }, (r) => { result = r; });
  assert.equal(result.state, 'LOOP_VERIFIED');
  assert.equal(calls.length, 3, 'no Kane sweep spawn in local mode — only the 3 testmd replays');
  assert.ok(calls.every((c) => c[0] === 'testmd'));
  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 5);
  assert.equal(lines[4].decision, 'sweep');
  assert.equal(lines[4].pass_kind, 'sweep');
  assert.equal(lines[4].verdict, 'LOOP_VERIFIED');
  assert.ok(/LOCAL-SWEEP/.test(lines[4].notes), 'the pass is labelled LOCAL-SWEEP');
  assert.ok(/NOT a Kane run/.test(lines[4].notes), 'the pass is never presented as a Kane run');
  fs.rmSync(dir, { recursive: true, force: true });
});

check('live loop refuses fast when preflight says not signed in (no Kane spawn)', () => {
  const dir = freshRoot();
  const journal = path.join(dir, 'journal.jsonl');
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: null });
  const calls = [];
  let result = null;
  runLiveGate({
    gate: gate, journalPath: journal, root: dir, url: 'http://localhost:8080',
    preflight: (cb) => cb({ signedIn: false, whoami: 'Not logged in' }),
    liveChecks: mockLiveChecksOk,
    spawnKane: scriptedSpawnKane(calls),
  }, (r) => { result = r; });
  assert.equal(result.state, 'PROVISIONAL_DONE');
  assert.equal(result.started, false);
  assert.equal(calls.length, 0, 'no Kane spawn without sign-in');
  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].classifier, 'DIDNT_START');
  assert.equal(lines[0].decision, 'setup');
  assert.equal(lines[0].exit_code, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

check('live loop refuses fast when live checks fail (signed in, credit guard refuses — no Kane spawn)', () => {
  const dir = freshRoot();
  const journal = path.join(dir, 'journal.jsonl');
  const gate = createGate({ objectiveHash: 'o1-loopmart-checkout', testFileHash: null });
  const calls = [];
  let result = null;
  runLiveGate({
    gate: gate, journalPath: journal, root: dir, url: 'http://localhost:8080',
    preflight: mockPreflight,
    liveChecks: (o, cb) => cb({ ok: false, balance: 100, reason: 'credit guard refused: projected cost 100 exceeds balance 100 minus reserve 250' }),
    spawnKane: scriptedSpawnKane(calls),
  }, (r) => { result = r; });
  assert.equal(result.state, 'PROVISIONAL_DONE');
  assert.equal(result.started, false);
  assert.equal(calls.length, 0, 'no Kane spawn when the credit guard refuses');
  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].classifier, 'DIDNT_START');
  assert.equal(lines[0].decision, 'setup');
  assert.equal(lines[0].exit_code, 2);
  assert.ok(/credit guard/.test(lines[0].notes), 'the refusal reason is in the journal');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(passed + ' live loop tests passed');

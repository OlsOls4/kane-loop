'use strict';
/**
 * Classifier + gate + runner tests — docs/loop-design.md §2–§5, §9–§10.
 * No live Kane run: synthetic NDJSON streams (and the seeded
 * double-charge fixture) are fed through the Day 1 parser into the
 * classifier, caps, fix contract, credit guard, journal, and the
 * debounce/single-flight runner.
 * Run: `node kane-watch/test/run-classifier.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createGate, routeRun, validateFix, creditGuard, appendJournal, parseNdjson,
} = require('../src/classifier.js');
const { createRunner } = require('../src/runner.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

function stream(failedStep, remark, extra) {
  const lines = [
    JSON.stringify({ type: 'stream_start', session_id: 'sess-test' }),
    JSON.stringify({ step: 'Add Loop Mug', status: 'done', remark: 'ok' }),
  ];
  if (failedStep) lines.push(JSON.stringify({ step: failedStep, status: 'failed', remark: remark }));
  const end = Object.assign({
    type: 'run_end', status: failedStep ? 'failed' : 'passed',
    summary: failedStep ? 'failed' : 'passed', reason: failedStep ? 'assertion failed' : '',
    duration: 50000, credits_consumed: 12,
    test_url: 'https://example.invalid/t/1', session_dir: '/tmp/kane/sess-test',
  }, extra || {});
  lines.push(JSON.stringify(end));
  return lines.join('\n') + '\n';
}

function parse(text, command, exitCode, durationMs) {
  return parseNdjson(text, command || 'run', exitCode === undefined ? 1 : exitCode, durationMs || 50000);
}

const SEEDED = fs.readFileSync(path.join(__dirname, 'fixtures', 'seeded-double-charge.ndjson'), 'utf8');
const FAIL_STEP = 'Verify the order ledger contains exactly one order';
const FAIL_REMARK = 'Ledger shows 2 orders for this checkout (LOOP-1001 and LOOP-1002); stock for Loop Mug is 8 (expected 9).';

check('seeded double-charge fixture: 740 + verdict -> APP_BUG', () => {
  const r = parseNdjson(SEEDED, 'run', 1, 54000);
  assert.equal(r.classification, 'APP_BUG');
  assert.equal(r.resultCode, 740);
  assert.equal(r.failingStep.step, FAIL_STEP);
  assert.equal(r.creditsConsumed, 14);
});

check('first red on a signature -> confirm-before-fix replay, no attempt consumed', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const r = parse(stream(FAIL_STEP, FAIL_REMARK, { result_code: 740, verdict: { confirmed_bug: true } }));
  const h = gate.handle(r, { kind: 'run' });
  assert.equal(h.decision.action, 'replay');
  assert.equal(h.decision.consumeAttempt, false);
  assert.equal(h.attemptsPerClaim, 0);
  assert.equal(h.state, 'PROVISIONAL_DONE');
});

check('second identical red -> fixer dispatched, one attempt consumed', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const r = parse(stream(FAIL_STEP, FAIL_REMARK, { result_code: 740, verdict: { confirmed_bug: true } }));
  gate.handle(r, { kind: 'run' });
  const h = gate.handle(r, { kind: 'run' });
  assert.equal(h.decision.action, 'fixer');
  assert.equal(h.decision.consumeAttempt, true);
  assert.equal(h.attemptsPerClaim, 1);
  assert.equal(h.attemptsBySignature, 1);
});

check('synthetic app-bug run_end routes to fixer; flake routes to replay-only', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const bug = parse(stream(FAIL_STEP, FAIL_REMARK));
  assert.equal(bug.classification, 'APP_BUG');
  const flakeText = '{"type":"stream_start"}\n{"step":"Add Loop Mug","status":"running"}\n{"step":"Add Loop Mug","status":"failed","remark":"element not ready, retry"}\n';
  const flake = parseNdjson(flakeText, 'run', 3, 120000);
  assert.equal(flake.classification, 'FLAKE_OR_TIMEOUT');
  const h1 = gate.handle(flake, { kind: 'run' });
  assert.equal(h1.decision.action, 'replay');
  assert.equal(h1.attemptsPerClaim, 0);
  const h2 = gate.handle(flake, { kind: 'run' });
  assert.equal(h2.decision.action, 'human-blocked');
  assert.equal(h2.state, 'HUMAN_BLOCKED');
});

check('analyzer failure (DIDNT_START with a terminal event) replays once, then blocks; upload-fail still goes to setup', () => {
  // Mirrors the real -6 replay evidence (evidence/o1-green-replay-3rd-2026-11-15.ndjson):
  // test_md_done failed, no verdict, no failing step event (the run_end
  // carries reason "analyzer_failed: @ step 18" but is not the terminal
  // for a testmd command, and no event carries a `step` field).
  const analyzerText = JSON.stringify({ type: 'stream_start', run_id: 'sess-an-1', synthetic: true }) + '\n'
    + JSON.stringify({ type: 'step_end', index: 18, status: 'failed', summary: 'analyze: Reading the displayed total from the cart summary' }) + '\n'
    + JSON.stringify({ type: 'run_end', run_id: 'run-0', status: 'failed', reason: 'analyzer_failed: @ step 18' }) + '\n'
    + JSON.stringify({ type: 'test_md_step_end', step_index: 1, status: 'failed' }) + '\n'
    + JSON.stringify({ type: 'test_md_done', overall_status: 'failed', duration_s: 23, session_id: 'sess-an-1' }) + '\n';
  const r = parse(analyzerText, 'testmd', 1, 23000);
  assert.equal(r.classification, 'DIDNT_START');
  assert.equal(r.terminalEvent, 'test_md_done');
  const gate = createGate({ objectiveHash: 'o1' });
  const h1 = gate.handle(r, { kind: 'replay' });
  assert.equal(h1.decision.action, 'replay', 'first analyzer failure: one bounded replay, no code change');
  assert.equal(h1.attemptsPerClaim, 0);
  const h2 = gate.handle(r, { kind: 'replay' });
  assert.equal(h2.decision.action, 'human-blocked', 'second consecutive analyzer failure blocks');
  assert.equal(h2.state, 'HUMAN_BLOCKED');
  // The carve-out: an upload/evidence/seal DIDNT_START still goes to
  // setup, never to a replay — nothing verifiable ran.
  const gate2 = createGate({ objectiveHash: 'o1' });
  const upload = parse(stream(null, null, { status: 'failed', reason: 'evidence upload failed: seal error' }), 'run', 1);
  assert.equal(upload.classification, 'DIDNT_START');
  assert.equal(gate2.handle(upload, { kind: 'run' }).decision.action, 'setup');
});

check("didn't-start (exit 2, no run_end) and upload-fail exit 1 -> setup, no code change, no attempt", () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const noStart = parseNdjson('{"type":"stream_start"}\n', 'run', 2, 2000);
  assert.equal(noStart.classification, 'DIDNT_START');
  assert.equal(gate.handle(noStart, { kind: 'run' }).decision.action, 'setup');
  const upload = parse(stream(null, null, { status: 'failed', reason: 'evidence upload failed: seal error' }), 'run', 1);
  assert.equal(upload.classification, 'DIDNT_START');
  assert.equal(gate.handle(upload, { kind: 'run' }).decision.action, 'setup');
  assert.equal(gate.attemptsPerClaim, 0);
});

check('test bug (unresolved_variables) -> test-fix, never the coder', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const r = parse(stream('Verify the stored total value', 'unresolved_variables: {{total}} has no value'));
  assert.equal(r.classification, 'TEST_BUG');
  const h = gate.handle(r, { kind: 'run' });
  assert.equal(h.decision.action, 'test-fix');
  assert.equal(h.attemptsPerClaim, 0);
});

check('exit 0 with no terminal -> INCONCLUSIVE: first replays, second consecutive blocks', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const r = parseNdjson('{"type":"stream_start"}\n{"step":"x","status":"done"}\n', 'run', 0, 30000);
  assert.equal(r.classification, 'INCONCLUSIVE');
  const h1 = gate.handle(r, { kind: 'run' });
  assert.equal(h1.decision.action, 'replay', 'first inconclusive: log + one replay, never a pass or a fix');
  const h2 = gate.handle(r, { kind: 'run' });
  assert.equal(h2.decision.action, 'human-blocked');
  assert.equal(h2.state, 'HUMAN_BLOCKED');
});

check('per-signature cap 3: 4th identical red -> HUMAN_BLOCKED, no 4th run', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  const r = parse(stream(FAIL_STEP, FAIL_REMARK));
  for (let i = 0; i < 3; i++) {
    gate.handle(r, { kind: 'run' }); // first red: replay
    const h = gate.handle(r, { kind: 'run' }); // second red: fixer
    assert.equal(h.decision.action, 'fixer', 'attempt ' + (i + 1));
  }
  assert.equal(gate.attemptsPerClaim, 3);
  gate.handle(r, { kind: 'run' });
  const blocked = gate.handle(r, { kind: 'run' });
  assert.equal(blocked.decision.action, 'human-blocked');
  assert.equal(blocked.state, 'HUMAN_BLOCKED');
});

check('per-claim cap 5: signature changes do not reset the count', () => {
  const gate = createGate({ objectiveHash: 'o1' });
  for (let i = 0; i < 5; i++) {
    const step = 'Failing step variant ' + i;
    const r = parse(stream(step, 'remark ' + i));
    gate.handle(r, { kind: 'run' });
    const h = gate.handle(r, { kind: 'run' });
    assert.equal(h.decision.action, 'fixer', 'claim attempt ' + (i + 1));
  }
  assert.equal(gate.attemptsPerClaim, 5);
  const r = parse(stream('Failing step variant 5', 'remark 5'));
  gate.handle(r, { kind: 'run' });
  const blocked = gate.handle(r, { kind: 'run' });
  assert.equal(blocked.decision.action, 'human-blocked');
  assert.equal(blocked.decision.reason, 'per-claim cap 5 reached');
});

check('GREEN = replay pass AND independent pass; two replays alone are not green', () => {
  const gate = createGate({ objectiveHash: 'o1', testFileHash: 'hash-o1-testmd' });
  // A testmd replay ends in test_md_done (overall_status), not run_end.
  const replayText = '{"type":"stream_start"}\n'
    + '{"type":"test_md_done","overall_status":"passed","duration_s":18,"session_id":"sess-r1","share_url":"https://example.invalid/t/r1"}\n';
  const replayPass = parseNdjson(replayText, 'testmd', 0, 18000);
  assert.equal(replayPass.classification, 'PASS');
  // Passes need provenance: the replay command (testmd + --no-adaptive-heal),
  // a run id, the committed test hash, and the replay inputs.
  const replayMeta = {
    kind: 'replay',
    command: 'kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal',
    runId: 'sess-r1', testFileHash: 'hash-o1-testmd', inputs: 'mug+hoodie, KANE10',
  };
  gate.handle(replayPass, replayMeta);
  gate.handle(replayPass, replayMeta);
  assert.equal(gate.state, 'PROVISIONAL_DONE');
  const sweepPass = parse(stream(null, null), 'run', 0, 50000);
  assert.equal(sweepPass.classification, 'PASS');
  gate.handle(sweepPass, {
    kind: 'sweep', runId: 'sess-sweep-1',
    inputs: '2x notebook + 1x mug, KANE10; qty 0; double-click Pay',
  });
  assert.equal(gate.state, 'LOOP_VERIFIED');
});

check('GREEN requires provenance: a replay pass without it does not count', () => {
  const gate = createGate({ objectiveHash: 'o1', testFileHash: 'hash-o1-testmd' });
  const replayText = '{"type":"stream_start"}\n'
    + '{"type":"test_md_done","overall_status":"passed","duration_s":18,"session_id":"sess-r1","share_url":"https://example.invalid/t/r1"}\n';
  const replayPass = parseNdjson(replayText, 'testmd', 0, 18000);
  const h = gate.handle(replayPass, { kind: 'replay' }); // no command/runId/hash
  assert.equal(h.replayPass, null);
  assert.ok(h.lastPassRejected);
  assert.equal(gate.state, 'PROVISIONAL_DONE');
});

check('an identical replay labelled "sweep" must not green the gate', () => {
  const gate = createGate({ objectiveHash: 'o1', testFileHash: 'hash-o1-testmd' });
  const replayText = '{"type":"stream_start"}\n'
    + '{"type":"test_md_done","overall_status":"passed","duration_s":18,"session_id":"sess-r1","share_url":"https://example.invalid/t/r1"}\n';
  const replayPass = parseNdjson(replayText, 'testmd', 0, 18000);
  const replayMeta = {
    kind: 'replay',
    command: 'kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal',
    runId: 'sess-r1', testFileHash: 'hash-o1-testmd', inputs: 'mug+hoodie, KANE10',
  };
  gate.handle(replayPass, replayMeta);
  // Same run id, same inputs, just relabelled as a sweep: rejected.
  const h = gate.handle(replayPass, { kind: 'sweep', runId: 'sess-r1', inputs: 'mug+hoodie, KANE10' });
  assert.equal(h.independentPass, null);
  assert.ok(h.lastPassRejected);
  assert.equal(gate.state, 'PROVISIONAL_DONE');
});

check('fix contract: good patch passes; test edit, hard-coded total, big diff, deletion fail', () => {
  const good = validateFix([{
    path: 'loopmart/app.js', added: 12, removed: 8,
    content: 'payBtn.disabled = state.processing;\n// guard: ignore clicks while processing\n',
  }]);
  assert.equal(good.ok, true);
  const testEdit = validateFix([{ path: 'tests/loopmart-checkout_test.md', added: 2, removed: 2, content: 'x' }]);
  assert.equal(testEdit.ok, false);
  assert.ok(testEdit.violations.some((v) => /test file/.test(v)));
  const hardCoded = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 0, content: 'return 4500; // Total paid £45.00' }]);
  assert.equal(hardCoded.ok, false);
  assert.ok(hardCoded.violations.some((v) => /hard-coded/.test(v)));
  const big = validateFix([
    { path: 'loopmart/app.js', added: 20, removed: 0, content: 'x' },
    { path: 'loopmart/cart.js', added: 20, removed: 0, content: 'x' },
  ]);
  assert.equal(big.ok, false);
  assert.ok(big.violations.some((v) => /over 30 lines/.test(v)));
  const deleted = validateFix([{ path: 'loopmart/cart.js', added: 0, removed: 0, content: '', deleted: true }]);
  assert.equal(deleted.ok, false);
  const outside = validateFix([{ path: 'package.json', added: 1, removed: 0, content: 'x' }]);
  assert.equal(outside.ok, false);
});

check('fix contract: loopmart/server.cjs is rejected (allow-list membership, not just the loopmart/ prefix)', () => {
  const server = validateFix([{ path: 'loopmart/server.cjs', added: 1, removed: 0, content: 'x' }]);
  assert.equal(server.ok, false);
  assert.ok(server.violations.some((v) => /allow-list/.test(v)));
  const cart = validateFix([{ path: 'loopmart/cart.js', added: 1, removed: 0, content: 'x' }]);
  assert.equal(cart.ok, true, 'allow-listed files still pass');
});

check('credit guard: fresh run that would spend the reserve is CREDIT_BLOCKED; replay (~0) is allowed', () => {
  const blocked = creditGuard(1000, 800, 150, 100);
  assert.equal(blocked.allowed, false);
  assert.ok(/CREDIT_BLOCKED/.test(blocked.reason));
  const ok = creditGuard(1000, 800, 150, 0);
  assert.equal(ok.allowed, true);
  const unknown = creditGuard(null, 0, 150, 10);
  assert.equal(unknown.allowed, false);
});

check('journal: appendJournal writes a valid JSONL line with the §10 fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-journal-'));
  const file = path.join(dir, 'journal.jsonl');
  appendJournal(file, {
    runId: '20261113-090000-1', classification: 'APP_BUG', attemptNo: 1,
    attemptsPerClaim: 1, exitCode: 1, terminalEvent: 'run_end', status: 'failed',
    creditsConsumed: 14, durationMs: 54000, testUrl: 'https://example.invalid/t/1',
    verdict: 'PROVISIONAL_DONE', notes: 'seeded double-charge',
  });
  const line = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(line.run_id, '20261113-090000-1');
  assert.equal(line.classifier, 'APP_BUG');
  assert.equal(line.credits_consumed, 14);
  assert.equal(line.verdict, 'PROVISIONAL_DONE');
  fs.rmSync(dir, { recursive: true, force: true });
});

check('runner: five rapid saves = exactly one run; save mid-run = one coalesced follow-up', () => {
  let now = 0;
  const timers = new Map();
  let timerSeq = 0;
  const fakeTimers = {
    setTimeout(fn, ms) { const id = ++timerSeq; timers.set(id, { fn: fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  function advance(ms) {
    now += ms;
    let due = [...timers.entries()].filter(([, t]) => t.at <= now);
    while (due.length > 0) {
      for (const [id, t] of due) { timers.delete(id); t.fn(); }
      due = [...timers.entries()].filter(([, t]) => t.at <= now);
    }
  }
  let runs = 0;
  let finishCurrent = null;
  const runner = createRunner((done) => {
    runs += 1;
    finishCurrent = done; // run stays "running" until the test finishes it
  }, { timers: fakeTimers, now: () => now });
  for (let i = 0; i < 5; i++) {
    runner.save('loopmart/app.js');
    advance(500);
  }
  assert.equal(runs, 0, 'no run before the 2s quiet period');
  advance(2000);
  assert.equal(runs, 1, 'five rapid saves = exactly one run');
  runner.save('loopmart/cart.js'); // save mid-run
  assert.equal(runner.pending, true);
  finishCurrent(); // run completes -> coalesced follow-up starts
  assert.equal(runs, 2);
  finishCurrent();
  assert.equal(runs, 2, 'no extra runs');
});

check('runner: ignored paths (journal, _test.md, .testmuai) never start a run', () => {
  let now = 0;
  const fakeTimers = { setTimeout() { return 1; }, clearTimeout() {} };
  let runs = 0;
  const runner = createRunner((done) => { runs += 1; done(); }, { timers: fakeTimers, now: () => now });
  assert.equal(runner.save('journal.jsonl'), 'ignored');
  assert.equal(runner.save('tests/loopmart-checkout_test.md'), 'ignored');
  assert.equal(runner.save('.testmuai/evidence/x.evidence'), 'ignored');
  assert.equal(runner.save('node_modules/x/index.js'), 'ignored');
  assert.equal(runs, 0);
});

console.log(passed + ' classifier/gate/runner tests passed');

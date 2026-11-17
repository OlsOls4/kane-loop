'use strict';
/**
 * Dry-run end-to-end loop test — the acceptance command from the
 * principal-engineer brief:
 *   node kane-watch/kane-watch.js --dry-run fixtures/seeded-double-charge.ndjson
 * closes the loop end-to-end (fail -> patch -> green) with no Kane
 * sign-in and no credits. Runs the real entry point as a child process
 * and checks the journal trace, the persisted state, the console data,
 * and the patched working copy.
 * Run: `node kane-watch/test/run-loop.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildKaneArgs } = require('../kane-watch.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

const ROOT = path.join(__dirname, '..', '..');

check('buildKaneArgs builds the real replay + sweep commands (zero code change when auth lands)', () => {
  const replay = buildKaneArgs({ command: 'testmd', testFile: '.testmuai/tests/loopmart-o1-core-8_test.md', url: 'http://localhost:8080' });
  assert.deepEqual(replay, ['testmd', 'run', '.testmuai/tests/loopmart-o1-core-8_test.md', '--agent', '--headless', '--no-adaptive-heal', '--bug-detection', 'continue', '--timeout', '300']);
  const sweep = buildKaneArgs({ command: 'run', objective: 'Go to http://localhost:8080 ...', url: 'http://localhost:8080' });
  assert.ok(sweep.includes('--bug-detection') && sweep.includes('continue'));
  assert.ok(sweep.includes('--agent') && sweep.includes('--headless'));
});

check('dry-run closes the loop end-to-end: fail -> patch -> green (LOOP_VERIFIED)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-loop-e2e-'));
  const journal = path.join(dir, 'journal.jsonl');
  const workdir = path.join(dir, 'work');
  const res = spawnSync('node', [
    path.join(ROOT, 'kane-watch', 'kane-watch.js'), '--dry-run',
    path.join(ROOT, 'kane-watch', 'test', 'fixtures', 'seeded-double-charge.ndjson'),
    '--journal', journal, '--workdir', workdir,
  ], { encoding: 'utf8', cwd: ROOT });
  assert.equal(res.status, 0, 'dry-run exit code (stdout: ' + res.stdout + ' stderr: ' + res.stderr + ')');
  assert.ok(/DRY-RUN LOOP_VERIFIED/.test(res.stdout), 'trace ends LOOP_VERIFIED');
  assert.ok(/FIX PROMPT/.test(res.stdout), 'the fixed-format fix prompt is emitted');

  const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 5, 'five journal lines: red, confirm, fix, replay, sweep');
  assert.deepEqual(lines.map((l) => l.decision), ['replay', 'fixer', 'fixer', 'replay', 'sweep']);
  assert.equal(lines[0].classifier, 'APP_BUG');
  assert.equal(lines[4].verdict, 'LOOP_VERIFIED');
  assert.equal(lines[3].pass_kind, 'replay');
  assert.equal(lines[4].pass_kind, 'sweep');
  assert.ok(lines.every((l) => /dry-run/.test(l.notes || '')), 'every line is labelled dry-run');
  assert.ok(lines[2].git_sha_before && lines[2].git_sha_after, 'fix line records content hashes');
  // The replay pass records the test-file hash so a judge can audit it.
  const crypto = require('node:crypto');
  const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, '.testmuai', 'tests', 'loopmart-o1-core-8_test.md'))).digest('hex').slice(0, 16); // sha256File slices to 16
  assert.equal(lines[3].test_file_hash, expectedHash, 'replay pass records the real _test.md hash (Wave 4 fix: the objective file is no longer what Kane runs)');
  assert.notEqual(lines[4].inputs, lines[3].inputs, 'sweep inputs differ from replay inputs');
  // Evidence hygiene (15 Nov): the red lines record the PARSED fixture
  // credits (14), not a hardcoded 0; the synthetic replay/sweep record
  // the parsed 0 (no Kane run, no credits consumed).
  assert.equal(lines[0].credits_consumed, 14, 'first red records the fixture credits_consumed (14)');
  assert.equal(lines[1].credits_consumed, 14, 'confirm red records the fixture credits_consumed (14)');
  assert.equal(lines[3].credits_consumed, 0, 'synthetic replay records 0 credits');
  assert.equal(lines[4].credits_consumed, 0, 'synthetic sweep records 0 credits');

  const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  assert.equal(state.state, 'LOOP_VERIFIED');
  assert.equal(state.mode, 'dry-run');
  assert.equal(state.attemptsPerClaim, 1);

  const consoleData = JSON.parse(fs.readFileSync(path.join(ROOT, 'loopmart', 'console-data.json'), 'utf8'));
  assert.equal(consoleData.verdict, 'EXAMPLE');
  assert.equal(consoleData.exampleRun.verdict, 'EXAMPLE');
  assert.equal(consoleData.runs.length, 5);
  assert.ok(consoleData.fixDiff.length > 0);
  assert.ok(/no live runs yet/.test(consoleData.credits.note));

  // The patched working copy is green: double-click is one order.
  const cartPath = path.join(workdir, 'loopmart', 'cart.js');
  delete require.cache[require.resolve(cartPath)];
  const LM = require(cartPath);
  const s = LM.freshState('buggy');
  LM.addToCart(s, 'mug', 1);
  LM.addToCart(s, 'hoodie', 1);
  LM.applyDiscount(s, 'KANE10');
  LM.pay(s);
  LM.pay(s);
  assert.equal(s.orders.length, 1, 'patched working copy still double-charges');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(passed + ' loop end-to-end tests passed');

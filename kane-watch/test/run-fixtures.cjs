'use strict';
/**
 * Day 1 parser fixture tests — docs/loop-design.md §11.
 * Run: `node test/run-fixtures.cjs` (exit 0 = all pass).
 * Fixtures:
 *  1. run-pass.ndjson            — 0.9.0-style `run_end` stream, exit 0 → PASS
 *  2. testmd-pass.ndjson         — `test_md_done` stream, exit 0 → PASS
 *  3. truncated-timeout.ndjson   — truncated stream, exit 3 → FLAKE_OR_TIMEOUT
 *  4. unknown-event.ndjson       — unknown event type injected → PASS, count 1
 *  5. exit-lies-pass.ndjson      — run_end passed but exit 1 → PASS (verdict wins)
 *  6. exit0-no-terminal.ndjson   — exit 0, no terminal event → INCONCLUSIVE
 *  7. wrong-terminal.ndjson      — test_md_done on a `kane run` → INCONCLUSIVE
 *  8. bug740.ndjson              — result_code 740 + verdict → APP_BUG
 *  9. upload-fail.ndjson         — exit 1, upload failure reason → DIDNT_START
 */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { parseNdjson } = require('../src/parse-ndjson.js');

const FIXTURES = path.join(__dirname, 'fixtures');

const CASES = [
  { file: 'run-pass.ndjson', command: 'run', exitCode: 0, durationMs: 42000,
    expect: { classification: 'PASS', status: 'passed', creditsConsumed: 12, unknownTypeCount: 0, corruptLines: 0 } },
  { file: 'testmd-pass.ndjson', command: 'testmd', exitCode: 0, durationMs: 18000,
    expect: { classification: 'PASS', status: 'passed', terminalEvent: 'test_md_done', unknownTypeCount: 0 } },
  { file: 'truncated-timeout.ndjson', command: 'run', exitCode: 3, durationMs: 120000,
    expect: { classification: 'FLAKE_OR_TIMEOUT', terminalEvent: null, corruptLines: 1 } },
  { file: 'unknown-event.ndjson', command: 'run', exitCode: 0, durationMs: 45000,
    expect: { classification: 'PASS', unknownTypeCount: 1 } },
  { file: 'exit-lies-pass.ndjson', command: 'run', exitCode: 1, durationMs: 40000,
    expect: { classification: 'PASS', status: 'passed' } },
  { file: 'exit0-no-terminal.ndjson', command: 'run', exitCode: 0, durationMs: 30000,
    expect: { classification: 'INCONCLUSIVE', terminalEvent: null } },
  { file: 'wrong-terminal.ndjson', command: 'run', exitCode: 0, durationMs: 20000,
    expect: { classification: 'INCONCLUSIVE', wrongTerminalEvent: 'test_md_done' } },
  { file: 'bug740.ndjson', command: 'run', exitCode: 1, durationMs: 55000,
    expect: { classification: 'APP_BUG', resultCode: 740, failingStep: 'Verify the order ledger contains exactly one order' } },
  { file: 'upload-fail.ndjson', command: 'run', exitCode: 1, durationMs: 48000,
    expect: { classification: 'DIDNT_START' } },
];

let passed = 0;
for (const c of CASES) {
  const text = fs.readFileSync(path.join(FIXTURES, c.file), 'utf8');
  const r = parseNdjson(text, c.command, c.exitCode, c.durationMs);
  for (const [key, want] of Object.entries(c.expect)) {
    let got = r[key];
    if (key === 'corruptLines') got = r.corruptLines.length;
    if (key === 'failingStep') got = r.failingStep ? r.failingStep.step : null;
    assert.equal(got, want, `${c.file}: ${key} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  console.log(`ok  ${c.file} -> ${r.classification}`);
  passed += 1;
}
console.log(`${passed}/${CASES.length} parser fixture tests passed`);

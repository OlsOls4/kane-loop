'use strict';
/**
 * Kane Loop — NDJSON parser for `kane-cli --agent` streams.
 *
 * Spec: docs/loop-design.md §11, docs/kane-objectives.md ("Reading output").
 * Rules:
 *  - One JSON event per line; blank lines skipped; corrupt lines kept with
 *    byte offset and parsing continues (a truncated final line on timeout
 *    is expected, not fatal).
 *  - Unknown event types are counted and ignored — never crash, never treat
 *    an unknown type as terminal.
 *  - Terminal event depends on the command: `run_end` for `kane run`,
 *    `test_md_done` for `testmd run`, `testrun_done` for `testrun run`.
 *    A run ending on the WRONG terminal type for its command is INCONCLUSIVE.
 *  - Exit-code-first, EXCEPT the verdict wins when both are present:
 *    exit codes lie (a replay can exit 1 while run_end says passed; a sweep
 *    can exit 0 while its verdict reports a confirmed bug). With
 *    --bug-detection, a confirmed product bug arrives as result_code 740
 *    with a verdict object — 740 is the primary "real bug" signal.
 *  - Exit 0 with no terminal event is INCONCLUSIVE, never PASS.
 *  - Never infer pass from absence of failure.
 */

const TERMINAL_BY_COMMAND = {
  run: 'run_end',
  testmd: 'test_md_done',
  testrun: 'testrun_done',
};

const TERMINAL_TYPES = new Set(['run_end', 'test_md_done', 'testrun_done', 'done']);

/**
 * Parse a full NDJSON stream.
 * @param {string} text - raw stdout of the kane-cli run.
 * @param {string} command - 'run' | 'testmd' | 'testrun'.
 * @param {number|null} exitCode - process exit code (null if unknown).
 * @param {number|null} durationMs - run duration in ms (null if unknown).
 * @returns {object} parse result incl. classification.
 */
function parseNdjson(text, command, exitCode = null, durationMs = null) {
  const expectedTerminal = TERMINAL_BY_COMMAND[command] || null;
  const events = [];
  const corruptLines = [];
  let unknownTypeCount = 0;
  let terminalEvent = null;
  let wrongTerminalEvent = null;
  let failingStep = null;

  let offset = 0;
  for (const rawLine of text.split('\n')) {
    const lineStart = offset;
    offset += Buffer.byteLength(rawLine, 'utf8') + 1; // +1 for the newline
    const line = rawLine.trim();
    if (!line) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      corruptLines.push({ offset: lineStart, raw: rawLine.slice(0, 200) });
      continue;
    }
    events.push(event);

    if (event.type) {
      if (TERMINAL_TYPES.has(event.type)) {
        if (event.type === expectedTerminal) {
          terminalEvent = event;
        } else {
          wrongTerminalEvent = event;
        }
      } else if (
        event.type !== 'stream_start' &&
        event.type !== 'error' &&
        event.type !== 'warning'
      ) {
        unknownTypeCount += 1;
      }
    } else if (event.step && event.status === 'failed') {
      // Progress events carry step/status/remark and no `type` field.
      if (!failingStep) failingStep = { step: event.step, remark: event.remark || null };
    }
  }

  // Verdict fields from the terminal event, when present.
  const terminal = terminalEvent;
  const status = terminal
    ? terminal.status || terminal.overall_status || null
    : null;
  const resultCode = terminal ? terminal.result_code ?? null : null;
  const verdict = terminal ? terminal.verdict ?? null : null;
  const reason = terminal ? terminal.reason || null : null;
  const creditsConsumed = terminal
    ? terminal.credits_consumed ?? terminal.credits ?? null
    : null;
  const testUrl = terminal ? terminal.test_url || terminal.share_url || null : null;

  const classification = classify({
    exitCode, durationMs, terminal, wrongTerminalEvent,
    status, resultCode, verdict, reason, failingStep,
  });

  return {
    command,
    exitCode,
    durationMs,
    eventCount: events.length,
    corruptLines,
    unknownTypeCount,
    terminalEvent: terminal ? terminal.type : null,
    wrongTerminalEvent: wrongTerminalEvent ? wrongTerminalEvent.type : null,
    status,
    resultCode,
    verdict,
    reason,
    creditsConsumed,
    testUrl,
    failingStep,
    classification,
  };
}

function classify(input) {
  const {
    exitCode, durationMs, terminal, wrongTerminalEvent,
    status, resultCode, verdict, reason, failingStep,
  } = input;

  // Wrong terminal type for the command: the run did not terminate properly.
  if (!terminal && wrongTerminalEvent) return 'INCONCLUSIVE';

  // No terminal event at all.
  if (!terminal) {
    if (exitCode === 2) return 'DIDNT_START';
    if (exitCode !== null && exitCode !== 0 && durationMs !== null && durationMs < 5000) {
      return 'DIDNT_START';
    }
    if (exitCode === 3) return 'FLAKE_OR_TIMEOUT';
    if (exitCode === 0) return 'INCONCLUSIVE';
    if (exitCode === 1) return 'FLAKE_OR_TIMEOUT';
    return 'INCONCLUSIVE';
  }

  // Terminal event present: the verdict wins over the exit code.
  if (resultCode === 740 || (verdict && verdict.confirmed_bug)) return 'APP_BUG';

  if (status === 'passed') return 'PASS';

  if (status === 'failed') {
    const reasonText = String(reason || '').toLowerCase();
    if (
      reasonText.includes('upload') ||
      reasonText.includes('evidence') ||
      reasonText.includes('seal')
    ) {
      return 'DIDNT_START';
    }
    if (!failingStep) return 'DIDNT_START';
    const remarkText = String(failingStep.remark || '').toLowerCase();
    if (
      remarkText.includes('unresolved_variables') ||
      remarkText.includes('ambiguous') ||
      remarkText.includes('could not find') ||
      remarkText.includes('element not found')
    ) {
      return 'TEST_BUG';
    }
    return 'APP_BUG';
  }

  // Terminal event with an unrecognised status: never a pass, never a fix.
  return 'INCONCLUSIVE';
}

module.exports = { parseNdjson, TERMINAL_BY_COMMAND };

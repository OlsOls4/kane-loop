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
 *  - Trust `run_end.status` and `verdict` TOGETHER, over the exit code:
 *    exit codes lie (a replay can exit 1 while run_end says passed; a sweep
 *    can exit 0 while its verdict reports a confirmed bug). With
 *    --bug-detection, a confirmed product bug arrives as `result_code` 740
 *    with a `verdict` object — 740 is the primary "real bug" signal, but
 *    only when the status agrees: a passed status with a confirmed-bug
 *    verdict is contradictory data (INCONCLUSIVE), and a failed status
 *    with no verdict is still an app bug.
 *  - Exit 1 with no terminal event: a truncated stream is a flake; a
 *    clean stream with no terminal event is DIDNT_START.
 *  - Exit 3 is timeout-or-cancelled for run/testmd, cancelled-only for
 *    testrun (INCONCLUSIVE there, not a flake).
 *  - Agent misstep (17 Nov gate surgery): a failed run with result_code
 *    710/720/750, or a verdict family of automation_bug with category
 *    agent_misstep AND a real failing step, is AGENT_MISSTEP — Kane's
 *    agent failed, not the app. It never reaches the fixer and never
 *    consumes an app attempt. The replay-analyzer failures carry the
 *    same family/category but no failing step and no result_code, so
 *    they stay DIDNT_START (the failing-step guard above runs first).
 */

const TERMINAL_BY_COMMAND = {
  run: 'run_end',
  testmd: 'test_md_done',
  testrun: 'testrun_done',
};

const TERMINAL_TYPES = new Set(['run_end', 'test_md_done', 'testrun_done', 'done']);

// Typed events Kane is known to emit (docs/kane-objectives.md "Reading
// output"). Anything else typed is genuinely unknown and counted —
// new event types can appear in any release, so unknown types are
// counted and ignored, never fatal. (Principal-engineer hardening,
// 15 Nov: the old code counted every known typed event as unknown.)
const KNOWN_TYPED_EVENTS = new Set([
  'stream_start', 'error', 'warning',
  'bifurcation', 'child_agent_start', 'child_agent_end',
  'ask_user', 'recording_state', 'project_folder_auto_defaulted',
]);

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
      } else if (!KNOWN_TYPED_EVENTS.has(event.type)) {
        unknownTypeCount += 1;
      }
    }
    // Failing step: step events carry step/status/remark. They usually
    // have no `type` field, but a real failed run can carry one — so the
    // failing step is read from ANY event with a failed step, typed or
    // not (principal-engineer hardening, 15 Nov: the old code only read
    // typeless events, so a typed failure could classify DIDNT_START).
    if (event.step && event.status === 'failed' && !failingStep) {
      failingStep = { step: event.step, remark: event.remark || null };
    }
  }

  // Verdict fields from the terminal event, when present.
  const terminal = terminalEvent;
  const status = terminal
    ? terminal.status || terminal.overall_status || null
    : null;
  // result_code is coerced with Number(): a strict === 740 misses the
  // string "740" (principal-engineer hardening, 15 Nov).
  const rawResultCode = terminal ? terminal.result_code ?? null : null;
  const coerced = rawResultCode === null || rawResultCode === undefined
    ? null : Number(rawResultCode);
  const resultCode = Number.isFinite(coerced) ? coerced : null;
  const verdict = terminal ? terminal.verdict ?? null : null;
  const reason = terminal ? terminal.reason || null : null;
  // Run-level text (B7 gate surgery 2, 17 Nov 2026): the run_end summary
  // carries the canonical app evidence even when the failing step's
  // remark does not (retry 3: all three sweeps' summaries cite "N
  // charges for one checkout" + LOOP-1002; the failing steps' remarks
  // were truncated or marker-free). The classifier reads these fields
  // for bug evidence; they are null when the terminal event lacks them.
  const summary = terminal ? terminal.summary || null : null;
  const oneLiner = terminal ? terminal.one_liner || null : null;
  const creditsConsumed = terminal
    ? terminal.credits_consumed ?? terminal.credits ?? null
    : null;
  const testUrl = terminal ? terminal.test_url || terminal.share_url || null : null;

  const classification = classify({
    exitCode, durationMs, terminal, wrongTerminalEvent,
    status, resultCode, verdict, reason, failingStep,
    command, corruptLines,
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
    summary,
    oneLiner,
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
    command, corruptLines,
  } = input;

  // Wrong terminal type for the command: the run did not terminate properly.
  // `done` terminates assurance streams only; on run/testmd/testrun it is
  // the wrong terminal, so it is INCONCLUSIVE here (docs/loop-design.md §11).
  if (!terminal && wrongTerminalEvent) return 'INCONCLUSIVE';

  // No terminal event at all.
  if (!terminal) {
    if (exitCode === 2) return 'DIDNT_START';
    if (exitCode !== null && exitCode !== 0 && durationMs !== null && durationMs < 5000) {
      return 'DIDNT_START';
    }
    // Exit 3 means timeout-or-cancelled for `kane run` / `testmd run`,
    // but cancelled ONLY for `testrun run` (no suite timeout) — a
    // cancelled testrun is not a flake (principal-engineer hardening).
    if (exitCode === 3) return command === 'testrun' ? 'INCONCLUSIVE' : 'FLAKE_OR_TIMEOUT';
    if (exitCode === 0) return 'INCONCLUSIVE';
    // Exit 1 with no terminal event (docs/loop-design.md §3, corrected
    // 15 Nov): a truncated stream (corrupt lines) is a flake/timeout;
    // a clean stream with no terminal event means nothing verifiable
    // ran — DIDNT_START, not an app bug.
    if (exitCode === 1) {
      return (corruptLines && corruptLines.length > 0) ? 'FLAKE_OR_TIMEOUT' : 'DIDNT_START';
    }
    return 'INCONCLUSIVE';
  }

  // Terminal event present: trust status and verdict TOGETHER, over the
  // exit code (exit codes lie). A 740 / confirmed-bug verdict does NOT
  // force APP_BUG when the status is 'passed' (Judge B, 15 Nov): a
  // passed status with a confirmed-bug verdict is contradictory data,
  // so it is INCONCLUSIVE, never a fix and never a pass.
  const bugConfirmed = resultCode === 740 || (verdict && verdict.confirmed_bug);
  if (status === 'passed') {
    return bugConfirmed ? 'INCONCLUSIVE' : 'PASS';
  }
  if (status === 'failed' && bugConfirmed) return 'APP_BUG';

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
    // Agent misstep (17 Nov gate surgery — B7 retry-1 sweeps): result
    // codes 710/720/750, or a verdict family of automation_bug with
    // category agent_misstep, mean KANE'S AGENT failed, not the app.
    // These are a distinct classification (AGENT_MISSTEP): never the
    // fixer, never an app attempt. The verdict family alone is NOT
    // enough — the replay-analyzer failures carry the same
    // family/category but no failing step and no result_code, so they
    // exit above as DIDNT_START and never reach this check.
    if (resultCode === 710 || resultCode === 720 || resultCode === 750) {
      return 'AGENT_MISSTEP';
    }
    if (verdict && typeof verdict === 'object') {
      const family = String(verdict.family || '').toLowerCase();
      const category = String(verdict.category || verdict.type || '').toLowerCase();
      if (family === 'automation_bug' && category === 'agent_misstep') {
        return 'AGENT_MISSTEP';
      }
    }
    const remarkText = String(failingStep.remark || '').toLowerCase();
    // TEST_BUG only on objective/element mismatch evidence — an
    // unresolved variable or an ambiguous objective. A missing element
    // ("could not find" / "element not found") must NOT auto-route to
    // TEST_BUG: an app bug that removes or renames the Pay button
    // produces exactly that remark. It is INCONCLUSIVE (human) unless a
    // 740/verdict confirms a bug (handled above).
    if (
      remarkText.includes('unresolved_variables') ||
      remarkText.includes('ambiguous')
    ) {
      return 'TEST_BUG';
    }
    if (
      remarkText.includes('could not find') ||
      remarkText.includes('element not found')
    ) {
      return 'INCONCLUSIVE';
    }
    return 'APP_BUG';
  }

  // Terminal event with an unrecognised status: never a pass, never a fix.
  return 'INCONCLUSIVE';
}

module.exports = { parseNdjson, TERMINAL_BY_COMMAND };

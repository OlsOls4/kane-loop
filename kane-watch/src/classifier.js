'use strict';
/**
 * Kane Loop — failure classifier + gate state machine.
 *
 * Spec: docs/loop-design.md §3 (classifier), §4 (fix contract),
 * §5 (two caps), §6 (green-twice), §9 (credit guard), §10 (journal).
 * Builds on src/parse-ndjson.js (Day 1, 9 fixtures passing).
 *
 * Routing (never infer pass from absence of failure):
 *   DIDNT_START      -> setup fix only, never to the coder, no attempt —
 *                       EXCEPT an analyzer failure (16 Nov 2026): a
 *                       DIDNT_START *with* a terminal event and no
 *                       upload/evidence/seal reason is a Kane-side
 *                       flake — one bounded replay, the second
 *                       consecutive one -> human (see isAnalyzerFlake).
 *   FLAKE_OR_TIMEOUT -> one zero-credit replay, no code change; a second
 *                       consecutive flake on the same signature -> human.
 *   TEST_BUG         -> fix the _test.md/objective only, counted separately.
 *   APP_BUG          -> fixer, and only APP_BUG consumes an app attempt.
 *   INCONCLUSIVE     -> first one: log + one replay (like a flake);
 *                       second consecutive one -> human-blocked.
 *   PASS             -> counts toward GREEN only with provenance (see
 *                       handle()): replay command incl. --no-adaptive-heal,
 *                       run id, test-file hash, and distinct sweep inputs.
 *
 * Confirm-before-fix: a first red on a signature triggers an immediate
 * replay before any code change. Only a second identical red dispatches
 * the fixer. Caps: 3 attempts per failure signature AND 5 per claim;
 * either exceeded -> HUMAN_BLOCKED, no further run. Replay cap: at most
 * 2 replays without a fixer dispatch in between, then HUMAN_BLOCKED
 * (backstop against a confirm-before-fix livelock).
 *
 * Signatures (user-panel HIGH, 15 Nov): the signature hashes the FAILING
 * STEP only — never the verbatim Kane remark. Real Kane remarks are
 * LLM-generated and vary between the first red and the confirm replay;
 * hashing the remark minted a new signature on the second red, so
 * pendingReds never matched and the fixer never dispatched.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const { parseNdjson } = require('./parse-ndjson.js');

const MAX_ATTEMPTS_PER_SIGNATURE = 3;
const MAX_ATTEMPTS_PER_CLAIM = 5;
const MAX_REPLAYS_WITHOUT_FIX = 2;

// The fixer may touch exactly these files (Wave 5, B14c): the old
// validateFix only checked the `loopmart/` prefix, so loopmart/server.cjs
// would have passed. Single source of truth — fixer.js imports this
// list from here (fixer already requires this module; no cycle).
const ALLOW_LISTED_FILES = ['loopmart/cart.js', 'loopmart/app.js'];

function normaliseStep(step) {
  return String(step || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function signatureFor(objectiveHash, failingStep) {
  return crypto.createHash('sha256')
    .update([objectiveHash || '', normaliseStep(failingStep)].join('|'))
    .digest('hex').slice(0, 16);
}

function isAppBug(parsed) {
  return parsed.classification === 'APP_BUG';
}

/**
 * Analyzer failure (16 Nov 2026, -6 replay, 5x): the terminal event
 * ARRIVED (test_md_done, overall_status failed) but carried no verdict
 * and no failing step — the browser test ran (18 actions executed), and
 * Kane's analyzer failed to read a value (real shape: run_end reason
 * "analyzer_failed: @ step 18", no step event with a `step` field).
 * That is a Kane-side flake, not a failure to start: one bounded replay,
 * the second consecutive one blocks. A DIDNT_START with NO terminal
 * event (exit 2, truncated stream) or an upload/evidence/seal reason
 * (nothing verifiable ran) is NOT this — it stays 'setup'.
 */
function isAnalyzerFlake(parsed) {
  if (!parsed.terminalEvent) return false;
  const reasonText = String(parsed.reason || '').toLowerCase();
  if (reasonText.includes('upload') || reasonText.includes('evidence') || reasonText.includes('seal')) return false;
  return true;
}

/**
 * Decide the routing for one parsed run. Pure function of the parse
 * result + gate state (pendingReds, attempt counts).
 * Returns { action, consumeAttempt, reason } where action is one of:
 *   'fixer' | 'replay' | 'setup' | 'test-fix' | 'human-blocked' | 'none'
 */
function routeRun(parsed, gate) {
  const c = parsed.classification;
  if (c === 'PASS') return { action: 'none', consumeAttempt: false, reason: 'pass' };
  if (c === 'DIDNT_START') {
    if (isAnalyzerFlake(parsed)) {
      if (gate.flakeCountFor(parsed) >= 1) {
        return { action: 'human-blocked', consumeAttempt: false, reason: 'second consecutive analyzer failure' };
      }
      if (gate.replaysSinceFix >= MAX_REPLAYS_WITHOUT_FIX) {
        return { action: 'human-blocked', consumeAttempt: false, reason: 'replay cap 2 reached without a fix' };
      }
      return { action: 'replay', consumeAttempt: false, reason: 'analyzer failure after a terminal event: replay once, no code change' };
    }
    return { action: 'setup', consumeAttempt: false, reason: 'run did not start' };
  }
  if (c === 'FLAKE_OR_TIMEOUT') {
    if (gate.flakeCountFor(parsed) >= 1) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'second consecutive flake' };
    }
    if (gate.replaysSinceFix >= MAX_REPLAYS_WITHOUT_FIX) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'replay cap 2 reached without a fix' };
    }
    return { action: 'replay', consumeAttempt: false, reason: 'first flake: replay once, no code change' };
  }
  if (c === 'TEST_BUG') return { action: 'test-fix', consumeAttempt: false, reason: 'test/objective bug, not app bug' };
  if (c === 'INCONCLUSIVE') {
    // First INCONCLUSIVE is treated like a flake (log + one replay);
    // only the second consecutive one blocks (principal-engineer
    // finding, 15 Nov — the old code blocked on the first).
    if (gate.inconclusiveCountFor(parsed) >= 1) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'second consecutive inconclusive run' };
    }
    if (gate.replaysSinceFix >= MAX_REPLAYS_WITHOUT_FIX) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'replay cap 2 reached without a fix' };
    }
    return { action: 'replay', consumeAttempt: false, reason: 'first inconclusive: replay once, no code change' };
  }
  if (c === 'APP_BUG') {
    const sig = signatureFor(gate.objectiveHash, parsed.failingStep && parsed.failingStep.step);
    if (gate.attemptsPerClaim >= MAX_ATTEMPTS_PER_CLAIM) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'per-claim cap 5 reached' };
    }
    if ((gate.attemptsBySignature[sig] || 0) >= MAX_ATTEMPTS_PER_SIGNATURE) {
      return { action: 'human-blocked', consumeAttempt: false, reason: 'per-signature cap 3 reached' };
    }
    if (!gate.pendingReds.has(sig)) {
      if (gate.replaysSinceFix >= MAX_REPLAYS_WITHOUT_FIX) {
        return { action: 'human-blocked', consumeAttempt: false, reason: 'replay cap 2 reached without a fix' };
      }
      return { action: 'replay', consumeAttempt: false, reason: 'first red: confirm-before-fix replay' };
    }
    return { action: 'fixer', consumeAttempt: true, reason: 'second identical red: dispatch fixer' };
  }
  return { action: 'human-blocked', consumeAttempt: false, reason: 'unknown classification' };
}

/**
 * Fix contract (spec §4). `diff` is an array of changed files:
 *   { path, added, removed, content } — content is the new file text.
 * Returns { ok, violations[] }. A violation rejects the patch, the
 * working tree is rolled back to sha_before, and CHEAT_REJECTED is logged.
 *
 * Anti-cheat (extended 15 Nov, Judge B): beyond the literal £45.00 /
 * 4500, the scan catches DISCOUNT_PERCENT tampering, object-literal or
 * assigned money totals, literal `return 4500`, and assertions weakened
 * to literal `true`.
 */
function validateFix(diff) {
  const violations = [];
  if (!Array.isArray(diff) || diff.length === 0) {
    return { ok: false, violations: ['empty diff'] };
  }
  if (diff.length > 3) violations.push('more than 3 files changed');
  let totalLines = 0;
  for (const f of diff) {
    totalLines += (f.added || 0) + (f.removed || 0);
    if (!ALLOW_LISTED_FILES.includes(f.path)) violations.push('file not on the allow-list: ' + f.path + ' (allow-list: ' + ALLOW_LISTED_FILES.join(', ') + ')');
    if (/_test\.md$/.test(f.path)) violations.push('test file edited: ' + f.path);
    if (/\bkane-watch\//.test(f.path)) violations.push('watcher edited: ' + f.path);
    if (f.deleted) violations.push('file deleted: ' + f.path + ' — file deletions are not allowed');
    // Line removals inside a file are allowed (a real fix removes the
    // buggy lines); only whole-file deletion is forbidden (spec §4).
    const text = f.content || '';
    if (/Total paid £45\.00|totalPence\s*=\s*4500|4500\s*\/\/\s*fixed/i.test(text)) {
      violations.push('hard-coded expected total in ' + f.path);
    }
    if (/if\s*\(\s*(test|kane|headless)\b/i.test(text)) {
      violations.push('test/environment sniffing in ' + f.path);
    }
    if (/discountPence\s*=\s*0|discountApplied\s*=\s*false;?\s*\/\/\s*removed/i.test(text)) {
      violations.push('discount logic removed in ' + f.path);
    }
    if (/(subtotal|discount|total)Pence\s*[:=]\s*\d+/.test(text)) {
      violations.push('literal money value assigned in ' + f.path);
    }
    if (/return\s+4500\b/.test(text)) {
      violations.push('hard-coded expected total (literal return) in ' + f.path);
    }
    if (/DISCOUNT_PERCENT\s*=\s*0\b/.test(text)) {
      violations.push('discount rate tampered in ' + f.path);
    }
    if (/A[1-5]\s*:\s*true\b/.test(text)) {
      violations.push('assertion weakened to literal true in ' + f.path);
    }
  }
  if (totalLines > 30) violations.push('diff over 30 lines (' + totalLines + ')');
  return { ok: violations.length === 0, violations };
}

/** Credit guard (spec §9): refuse a fresh run that would spend the reserve. */
function creditGuard(balance, spent, reserve, projectedCost) {
  if (balance === null || balance === undefined) return { allowed: false, reason: 'balance unknown' };
  if (spent + projectedCost > balance - reserve) {
    return { allowed: false, reason: 'CREDIT_BLOCKED: fresh run would spend the reserve' };
  }
  return { allowed: true, reason: 'within budget' };
}

/** Append one journal line (spec §10 schema, minimal fields). */
function appendJournal(journalPath, entry) {
  const line = JSON.stringify({
    run_id: entry.runId,
    loop_id: entry.loopId || 'loopmart',
    timestamp: new Date().toISOString(),
    trigger: entry.trigger || 'manual',
    git_sha_before: entry.shaBefore || null,
    git_sha_after: entry.shaAfter || null,
    dirty_before: !!entry.dirtyBefore,
    objective_hash: entry.objectiveHash || null,
    signature: entry.signature || null,
    classifier: entry.classification,
    decision: entry.decision || null,
    attempt_no: entry.attemptNo || 0,
    attempts_per_claim: entry.attemptsPerClaim || 0,
    exit_code: entry.exitCode === undefined ? null : entry.exitCode,
    terminal_event: entry.terminalEvent || null,
    status: entry.status || null,
    credits_consumed: entry.creditsConsumed === undefined ? null : entry.creditsConsumed,
    duration_ms: entry.durationMs === undefined ? null : entry.durationMs,
    test_url: entry.testUrl || null,
    evidence_path: entry.evidencePath || null,
    verdict: entry.verdict || null,
    pass_kind: entry.passKind || null,
    pass_run_id: entry.passRunId || null,
    test_file_hash: entry.testFileHash || null,
    inputs: entry.inputs || null,
    notes: entry.notes || null,
  }) + '\n';
  fs.appendFileSync(journalPath, line, 'utf8');
  return line;
}

/**
 * Rebuild gate state from a journal file. state.json is DERIVED from
 * journal.jsonl, never the source of truth — so restarting the watcher
 * preserves attempt counts (principal-engineer finding, 15 Nov).
 * Returns { attemptsBySignature, attemptsPerClaim, pendingReds,
 * state, replayPass, independentPass }.
 */
function rebuildStateFromJournal(journalPath) {
  const st = {
    attemptsBySignature: {},
    attemptsPerClaim: 0,
    pendingReds: [],
    state: 'PROVISIONAL_DONE',
    replayPass: null,
    independentPass: null,
  };
  let text;
  try {
    text = fs.readFileSync(journalPath, 'utf8');
  } catch (e) {
    return st; // no journal yet: fresh claim
  }
  const pending = new Set();
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    let e;
    try { e = JSON.parse(raw); } catch (err) { continue; }
    if (e.attempts_per_claim) st.attemptsPerClaim = Math.max(st.attemptsPerClaim, e.attempts_per_claim);
    if (e.signature && e.attempt_no) {
      st.attemptsBySignature[e.signature] = Math.max(st.attemptsBySignature[e.signature] || 0, e.attempt_no);
    }
    if (e.signature && e.classifier === 'APP_BUG') {
      if (e.decision === 'replay') pending.add(e.signature);
      if (e.decision === 'fixer') pending.delete(e.signature);
    }
    if (e.pass_kind === 'replay' && e.pass_run_id) st.replayPass = { runId: e.pass_run_id };
    if (e.pass_kind === 'sweep' && e.pass_run_id) st.independentPass = { runId: e.pass_run_id };
    if (e.verdict === 'HUMAN_BLOCKED' || e.verdict === 'LOOP_VERIFIED' || e.verdict === 'CHEAT_REJECTED') {
      st.state = e.verdict;
    }
  }
  st.pendingReds = [...pending];
  return st;
}

/** Minimal in-memory gate state for one claim (one PROVISIONAL_DONE). */
function createGate(opts) {
  const o = opts || {};
  const gate = {
    objectiveHash: o.objectiveHash || 'o1-loopmart-checkout',
    // Hash of the committed _test.md (or objective file while no _test.md
    // exists yet). A replay pass whose hash differs is a healed test and
    // does not count. Null adopts the first replay's hash as the baseline.
    testFileHash: o.testFileHash === undefined ? null : o.testFileHash,
    attemptsBySignature: {},
    attemptsPerClaim: 0,
    pendingReds: new Set(),
    flakeSignatures: new Map(),
    inconclusiveSignatures: new Map(),
    replaysSinceFix: 0,
    replayPass: null, // { runId, command, testFileHash, inputs } once recorded
    independentPass: null, // { runId, inputs } once recorded
    lastPassRejected: null,
    state: 'PROVISIONAL_DONE', // PROVISIONAL_DONE | LOOP_VERIFIED | HUMAN_BLOCKED | CHEAT_REJECTED

    flakeCountFor(parsed) {
      const sig = signatureFor(this.objectiveHash,
        parsed.failingStep && parsed.failingStep.step);
      return this.flakeSignatures.get(sig) || 0;
    },

    inconclusiveCountFor(parsed) {
      const sig = signatureFor(this.objectiveHash,
        parsed.failingStep && parsed.failingStep.step);
      return this.inconclusiveSignatures.get(sig) || 0;
    },

    /** Handle one parsed run; returns the routing decision + new state. */
    handle(parsed, meta) {
      const decision = routeRun(parsed, this);
      const sig = signatureFor(this.objectiveHash,
        parsed.failingStep && parsed.failingStep.step);
      if (parsed.classification === 'FLAKE_OR_TIMEOUT'
        || (parsed.classification === 'DIDNT_START' && isAnalyzerFlake(parsed))) {
        this.flakeSignatures.set(sig, (this.flakeSignatures.get(sig) || 0) + 1);
      }
      if (parsed.classification === 'INCONCLUSIVE') {
        this.inconclusiveSignatures.set(sig, (this.inconclusiveSignatures.get(sig) || 0) + 1);
      }
      if (parsed.classification === 'APP_BUG' && decision.action === 'replay') {
        this.pendingReds.add(sig);
      }
      if (decision.action === 'replay') {
        this.replaysSinceFix += 1;
      }
      if (decision.consumeAttempt) {
        this.attemptsBySignature[sig] = (this.attemptsBySignature[sig] || 0) + 1;
        this.attemptsPerClaim += 1;
        this.pendingReds.delete(sig);
        this.replaysSinceFix = 0; // a fixer dispatch is progress
      }
      if (decision.action === 'human-blocked') this.state = 'HUMAN_BLOCKED';
      // Pass provenance (Judge B, 15 Nov): caller-supplied meta.kind is
      // NOT accepted at face value. A replay pass must carry the testmd
      // command incl. --no-adaptive-heal, a run id, the committed test
      // hash, and the replay inputs; a sweep pass must be a DIFFERENT
      // run with DIFFERENT inputs from the replay, or it does not count.
      // An identical replay labelled "sweep" must not green the gate.
      if (parsed.classification === 'PASS' && meta) {
        if (meta.kind === 'replay') {
          const hashOk = typeof meta.testFileHash === 'string' && meta.testFileHash.length > 0
            && (this.testFileHash === null || meta.testFileHash === this.testFileHash);
          const ok = typeof meta.command === 'string'
            && meta.command.includes('testmd') && meta.command.includes('--no-adaptive-heal')
            && typeof meta.runId === 'string' && meta.runId.length > 0
            && typeof meta.inputs === 'string' && meta.inputs.length > 0
            && hashOk;
          if (ok) {
            if (this.testFileHash === null) this.testFileHash = meta.testFileHash;
            this.replayPass = {
              runId: meta.runId, command: meta.command,
              testFileHash: meta.testFileHash, inputs: meta.inputs,
            };
            this.lastPassRejected = null;
          } else {
            this.lastPassRejected = {
              kind: 'replay',
              reason: this.testFileHash !== null && meta.testFileHash !== this.testFileHash
                ? 'test file changed since the claim started — healed test suspected'
                : 'replay pass missing provenance (testmd + --no-adaptive-heal + run id + test hash + inputs)',
            };
          }
        } else if (meta.kind === 'sweep') {
          const ok = this.replayPass
            && typeof meta.runId === 'string' && meta.runId.length > 0
            && typeof meta.inputs === 'string' && meta.inputs.length > 0
            && meta.runId !== this.replayPass.runId
            && meta.inputs !== this.replayPass.inputs;
          if (ok) {
            this.independentPass = { runId: meta.runId, inputs: meta.inputs };
            this.lastPassRejected = null;
          } else {
            this.lastPassRejected = {
              kind: 'sweep',
              reason: 'sweep is not independent of the replay (same run id, same inputs, or no replay pass yet)',
            };
          }
        }
      }
      if (this.replayPass && this.independentPass) this.state = 'LOOP_VERIFIED';
      return {
        decision: decision,
        signature: sig,
        attemptsBySignature: this.attemptsBySignature[sig] || 0,
        attemptsPerClaim: this.attemptsPerClaim,
        replaysSinceFix: this.replaysSinceFix,
        state: this.state,
        green: !!(this.replayPass && this.independentPass),
        replayPass: this.replayPass,
        independentPass: this.independentPass,
        lastPassRejected: this.lastPassRejected,
      };
    },
  };
  return gate;
}

module.exports = {
  MAX_ATTEMPTS_PER_SIGNATURE: MAX_ATTEMPTS_PER_SIGNATURE,
  MAX_ATTEMPTS_PER_CLAIM: MAX_ATTEMPTS_PER_CLAIM,
  MAX_REPLAYS_WITHOUT_FIX: MAX_REPLAYS_WITHOUT_FIX,
  ALLOW_LISTED_FILES: ALLOW_LISTED_FILES,
  signatureFor: signatureFor,
  normaliseStep: normaliseStep,
  isAppBug: isAppBug,
  routeRun: routeRun,
  validateFix: validateFix,
  creditGuard: creditGuard,
  appendJournal: appendJournal,
  rebuildStateFromJournal: rebuildStateFromJournal,
  createGate: createGate,
  parseNdjson: parseNdjson,
};

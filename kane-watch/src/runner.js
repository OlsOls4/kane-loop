'use strict';
/**
 * Kane Loop — runner: debounce + single-flight + Kane spawn.
 *
 * Spec: docs/loop-design.md §2 (debounce/single-flight), §7 (replay-first),
 * §12 (local target). Live mode spawns `kane-cli` with --agent and feeds
 * the NDJSON stream to the parser + classifier. Dry-run mode feeds a
 * supplied NDJSON string instead, so the debounce/single-flight/classifier
 * path is testable with no Kane sign-in and no credits.
 *
 * Preflight: live runs refuse to start when `kane-cli whoami` shows not
 * logged in, with a human-readable error — never a silent hang on auth.
 * A run is killed as a whole process group (GuardianKane's lesson: an
 * orphaned headless Chrome otherwise survives a timeout).
 */
const { spawn, execFile } = require('node:child_process');
const { parseNdjson } = require('./parse-ndjson.js');

const DEBOUNCE_MS = 2000;      // 2s quiet period (trailing edge)
const STARVATION_MS = 10000;   // force a run after 10s of continuous saves
const RUN_TIMEOUT_MS = 120000; // default spawn kill-switch; runLiveGate passes 300000 for replay/sweep (measured runs take ~180 s)

function preflight(callback) {
  execFile('kane-cli', ['whoami'], { timeout: 15000 }, (err, stdout) => {
    const out = String(stdout || '') + String((err && err.message) || '');
    const signedIn = !/not logged in/i.test(out) && !err;
    callback({ signedIn: signedIn, whoami: out.trim().slice(0, 300) });
  });
}

/**
 * Spawn one Kane run. `opts`: { command: 'run'|'testmd', args: string[],
 *   onLine: fn(line), timeoutMs }. Returns a child handle; the caller
 *   collects stdout and calls parseNdjson on completion. The child is
 *   spawned detached so the whole process group can be killed on timeout.
 */
function spawnKane(opts, done) {
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  // Node emits 'close' after 'error' on spawn failure, so both handlers
  // would call done() without this guard (principal-engineer finding).
  let settled = false;
  function finish(result) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    done(result);
  }
  const child = spawn(opts.binary || 'kane-cli', opts.args, {
    detached: true,
    env: Object.assign({}, process.env, { KANE_CLI_USER_AGENT: 'kane-watch' }),
  });
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { /* already gone */ }
    setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { /* already gone */ }
    }, 5000);
  }, opts.timeoutMs || RUN_TIMEOUT_MS);
  child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
  child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
  child.on('error', (err) => {
    finish({ exitCode: 2, stdout: stdout, stderr: stderr + '\n' + err.message, durationMs: Date.now() - startedAt, timedOut: timedOut });
  });
  child.on('close', (code) => {
    finish({ exitCode: code === null ? 3 : code, stdout: stdout, stderr: stderr, durationMs: Date.now() - startedAt, timedOut: timedOut });
  });
  return child;
}

/**
 * Debounce + single-flight queue.
 * - save(path): ignored paths (node_modules, .testmuai, evidence, *_test.md,
 *   journal, state, console) never start a run (spec §2, hardening test 10).
 * - 2s trailing-edge debounce; 10s starvation cap forces a run.
 * - At most one run at a time; a save during a run sets pending=true only.
 * - Five rapid saves = exactly one run; a save mid-run = exactly one
 *   coalesced follow-up run.
 * `runFn(done)` performs one run and calls done() when finished.
 * In dry-run mode the caller supplies runFn that feeds synthetic NDJSON.
 */
const IGNORED = [
  /node_modules/,
  /\.testmuai\//,
  /\/evidence\//,
  /_test\.md$/,
  /journal\.jsonl$/,
  /state\.json$/,
  /console-data\.json$/,
];

function createRunner(runFn, opts) {
  const o = opts || {};
  const debounceMs = o.debounceMs || DEBOUNCE_MS;
  const starvationMs = o.starvationMs || STARVATION_MS;
  const timers = o.timers || { setTimeout: setTimeout, clearTimeout: clearTimeout };
  const now = o.now || Date.now;
  let running = false;
  let pending = false;
  let lastSave = 0;
  // Null sentinel, not 0: a save at t=0 is masked by falsy-0, and the
  // starvation window is measured from the first save of the current
  // burst. Reset on EVERY run start (principal-engineer finding, 15 Nov:
  // the old code only reset on the starvation path, so after 10s of
  // watcher lifetime every save fired immediately — credit burn/run spam).
  let firstSave = null;
  let timer = null;
  let runsStarted = 0;

  function schedule() {
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(checkQuiet, debounceMs);
  }

  function checkQuiet() {
    timer = null;
    if (now() - lastSave < debounceMs) { schedule(); return; }
    if (running) { pending = true; return; }
    startRun();
  }

  function startRun() {
    running = true;
    firstSave = null;
    runsStarted += 1;
    runFn(function onDone() {
      running = false;
      if (pending) {
        pending = false;
        lastSave = now();
        firstSave = now();
        startRun();
      }
    });
  }

  return {
    save(path) {
      if (IGNORED.some((re) => re.test(path))) return 'ignored';
      const t = now();
      lastSave = t;
      if (firstSave === null) firstSave = t;
      if (running) { pending = true; return 'coalesced'; }
      schedule();
      // Starvation cap: continuous saves force a run after 10s.
      if (t - firstSave >= starvationMs) {
        if (timer) timers.clearTimeout(timer);
        timer = null;
        startRun();
      }
      return 'scheduled';
    },
    get runsStarted() { return runsStarted; },
    get running() { return running; },
    get pending() { return pending; },
  };
}

/** Dry-run helper: feed a synthetic NDJSON stream through the parser. */
function dryRun(text, command, exitCode, durationMs) {
  return parseNdjson(text, command, exitCode, durationMs);
}

module.exports = {
  DEBOUNCE_MS: DEBOUNCE_MS,
  STARVATION_MS: STARVATION_MS,
  RUN_TIMEOUT_MS: RUN_TIMEOUT_MS,
  preflight: preflight,
  spawnKane: spawnKane,
  createRunner: createRunner,
  dryRun: dryRun,
};

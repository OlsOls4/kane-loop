# Kane Loop — Watcher / Veto-Gate Design (prose + pseudocode)

**Status:** DESIGN ONLY — pseudocode in this file is specification, not code. No code files are written before 12 Nov. The build team implements from this file on 12–14 Nov.
**Shape (Wave 2 engineers — collapse, don't add):** one runner with two modes (`author` / `gate`), LoopMart + a static Loop Console generated from the journal and served by the same LoopMart server. **No separate dashboard server, no MCP, no live-polling UI.** The veto gate must stay a *separate process* from the coding agent — separation of duties is the whole claim — but it must not become a second Kane runner, a second app, or a second state store. **One state file, one journal, one parser.**

## 1. What the loop is (and is not)

**What it is:** `kane-watch` — a file watcher / save hook that fires Kane CLI, parses NDJSON, classifies the result, and (only for a genuine app bug, confirmed twice) applies a validated reference patch for the bug class itself — the loop is the agent side. The fixed-format FIX PROMPT is the audit record of the failure the patch addresses (failing step, remark, allow-listed files), emitted to stdout and the journal; it is not sent to an external agent. The agent's "done" is provisional (`PROVISIONAL_DONE`); only the separate verifier process can write `LOOP_VERIFIED`, after replay + independent sweep. Cap: 3 attempts per failure signature AND 5 attempts per claim; then a visible human-blocked state. Anti-cheat: a fix that deletes an assertion, hard-codes a value, or edits a test is rejected and rolled back.

**15 Nov correction — fixer honesty.** The earlier draft of this section said the gate "hands a minimal fix prompt to the coding agent". No external agent is ever invoked: the loop's fixer is a bounded reference patcher (strategies: double-charge idempotency guard, G1 ledger-preserve) and the loop applies the patch itself, validated by the fix contract. The FIX PROMPT is the fixed-format failure record the patcher consumes — and the audit trail — not a handoff.

**What it is not:** a Claude Code Stop-hook (GuardianKane's mechanism — do not copy it; `kane-watch` is agent-agnostic: on save / on git diff, any agent/stack, which is what Luma's "any agent, any stack" invites). Not a dashboard product. Not a PRD tracker, scope guard, secret scanner, or file locker (GuardianKane features — do not ship them).

**Differentiator over the official skill (must be true in the code, README paragraph 1):** diff-scoped objectives + committed `_test.md` suite replayed instead of re-authored + credit budgeting + 3-attempt escalation to a visible human-blocked state + independent second Kane check with anti-cheat + verdict-based gating on `result_code` 740. The skill alone does none of those.

## 2. File-watching / debounce (2s quiet) + single-flight

Watch only `app/**` (LoopMart source). **Ignore** `node_modules`, `.testmuai/`, `evidence/`, `*_test.md`, the journal, the state file, and console output — otherwise the loop triggers itself.

Pseudocode — trailing-edge debounce with a starvation cap:

```
on_save(path):
  if ignored(path): return
  pending = true; last_save = now()
  // trailing edge: reset the 2s timer on every save; force a run after 10s
  // of continuous saves so an active editor cannot starve the loop
  schedule(check_quiet, 2s)

check_quiet():
  if now() - last_save < 2s: reschedule; return
  if running: pending = true; return        // coalesce, do not queue N runs
  start_gate_run()
```

Single-flight: at most one Kane child at a time. A save during a run sets `pending=true` only; on run completion, if `pending`, run once. **Five rapid saves = exactly one Kane run.** Cancelling a run (new save + explicit cancel): SIGTERM, 5s grace, SIGKILL, wait for exit, record as `cancelled` — never as pass/fail, never fed to the fixer, never counted as an attempt. Kill the whole spawned process group (GuardianKane's lesson: an orphaned headless Chrome otherwise survives a timeout). Kill must also release the lock file; a stale lock on startup is a **fatal preflight error**, not silently cleared.

## 3. Failure classifier — exit-code-first, then stream; trust the verdict

Inputs, in order: process exit code, presence/absence of a terminal event, `run_end.status` / `result_code` / `verdict`, failing step + `remark`, duration, stream completeness. **Never infer pass from absence of failure.**

```
classify(exit, terminal, run_end):
  if exit == 2 or (exit != 0 and terminal is None and duration < 5s):
      return DIDNT_START        // sign-in/config/no URL/Chrome/network
  if terminal is None:
      if exit == 1 and stream is clean (no corrupt lines):
          return DIDNT_START    // clean exit-1 with no terminal: nothing ran
      if exit == 1 and stream is truncated (corrupt lines):
          return FLAKE_OR_TIMEOUT
      if exit == 3 and command is testrun:
          return INCONCLUSIVE   // exit 3 is cancelled-only for testrun
      return FLAKE_OR_TIMEOUT   // timeout / killed / truncated
  if exit == 1:
      if run_end.reason matches upload/evidence/seal failure
         or status == failed and no failing step recorded:
          return DIDNT_START    // Wave 1's known trap: exit 1 != app bug
      if run_end.status == passed and (result_code == 740 or verdict.confirmed_bug):
          return INCONCLUSIVE   // contradictory data — never APP_BUG
      if failing step is ambiguous / unresolved_variables:
          return TEST_BUG
      if failing step remark says "could not find" / "element not found"
         and no 740/verdict confirms a bug:
          return INCONCLUSIVE   // an app bug removing the Pay button produces exactly this remark
      return APP_BUG
  if exit == 0 and terminal.status == passed: return PASS
  else: return INCONCLUSIVE     // exit 0 with no terminal event is NOT a pass
```

**15 Nov correction (spec/code drift, user panel #3).** The earlier draft of this section said exit-1-with-no-terminal was `DIDNT_START` unconditionally, and the parser returned `FLAKE_OR_TIMEOUT` for it. The rule above is the implemented one: clean stream → `DIDNT_START`, truncated stream → `FLAKE_OR_TIMEOUT`. The `done` event is an assurance-stream terminal only — on `run`/`testmd`/`testrun` it is the wrong terminal type, so it classifies `INCONCLUSIVE` (correct as written in §11).

**Wave 2 correction — trust the verdict, not the exit code.** Exit codes lie: a replay can exit 1 while its final `run_end` reports `status: 'passed'`; a sweep can exit 0 while its verdict reports a confirmed bug. The classifier must read `run_end.status` / `result_code` / `verdict` **over** the process exit code, and the gate verdict is the structured verdict, not the exit code. With `--bug-detection`, a confirmed product bug arrives as **`result_code` 740 with a `verdict` object** — 740 is the primary "real bug" signal.

**15 Nov correction — status and verdict together (Judge B 2b).** A 740 / `verdict.confirmed_bug` must NOT force `APP_BUG` when `run_end.status` is `passed` — that combination is contradictory data and classifies `INCONCLUSIVE`. Trust status + verdict together: `failed` + 740/confirmed → `APP_BUG`; `passed` alone → `PASS`; `passed` + 740/confirmed → `INCONCLUSIVE`.

**15 Nov correction — missing-element remarks (Judge B 2a).** A failing-step remark containing "could not find" / "element not found" must NOT auto-route to `TEST_BUG`: an app bug that removes or renames the Pay button produces exactly that remark. Route on `result_code`/verdict first; treat missing-element failures as `INCONCLUSIVE` (human) unless a 740/verdict confirms a bug. `TEST_BUG` is for genuinely ambiguous objectives / `unresolved_variables` only.

**Routing:**
- `DIDNT_START` → setup fix only, never to the coder, no attempt consumed.
- `FLAKE_OR_TIMEOUT` → one zero-credit replay, no code change; a second consecutive flake on the same signature → human-blocked.
- `TEST_BUG` → fix the `_test.md`/objective only, by a human-approved edit, counted separately from app attempts.
- `APP_BUG` → fixer, and **only `APP_BUG` consumes an app attempt**.
- `INCONCLUSIVE` → never a pass, never a fix; log and human-blocked if it repeats.
  **15 Nov correction (principal engineer #6):** the first `INCONCLUSIVE` is treated like a
  flake — log it and replay once; block on the second consecutive one. The earlier
  implementation blocked on the first, contradicting this design.

**Confirm-before-fix (Wave 2 engineers' correction — load-bearing):** first red on a signature triggers an immediate zero-credit replay (O3 in `02`) *before* any code change. Only a second identical red dispatches the fixer. This is the flake filter; it costs nothing on replay and is what stops a flaky red from causing a spurious "fix".

## 4. Fix contract (patch only, allow-list, no test/watcher edits)

The fixer is **not trusted by prompt**. The gate enforces, after the fixer returns and before any re-run:

```
allow: app/** only                     // LoopMart source
deny:  **/*_test.md, watcher/**, console/**, journal, state,
       package.json, *.config.*, evidence/**
limits: diff ≤ 30 lines, ≤ 3 files, no file deletions
forbid in diff: literal order-total / confirmation constants,
       `if (test|kane|headless)`, deleted/weakened assertions,
       removal of discount / quantity / pay logic
       // 15 Nov (Judge B 4): also DISCOUNT_PERCENT tampering,
       // object-literal totals, literal `return <pence>`, and any
       // `A[1-5]: true` assertion weakening
on violation: reject patch, restore git sha_before, log CHEAT_REJECTED,
       attempt still consumed, fixer gets the rejection reason only
       // 15 Nov: in the staged (non-git) working tree the rollback
       // restores pre-patch file contents by content hash instead
on pass: git sha_after recorded; re-run is replay-first (see §6)
```

Fixer input is minimal and fixed-format: failing step, Kane's verbatim `remark`, screenshot path, allow-listed file list. **No full NDJSON, no journal history** — both leak prompt-injection surface and tokens. The fixed-format record is what the loop's own patcher consumes (and what is emitted as the FIX PROMPT audit record) — it is not sent to an external agent (15 Nov correction, see §1). Rollback is `git checkout sha_before` of allow-listed paths; the working tree must be clean at gate start or `dirty=true` is recorded and the run is marked unreproducible.

**Fixer strategies (15 Nov):** `double-charge` (idempotency guard: `pay()` returns the existing confirmation; clicks ignored while Processing) and `g1-ledger` (G1: `reset()` preserves `state.orders`, so the ledger survives "Start new order" per spec §3.4). G1 stays unfixed in the shipped code so Kane has a real bug to catch; the strategy exists so the loop can fix it the moment Kane catches it live.

## 5. Attempt caps + human-blocked (two caps — Wave 2 correction)

Wave 1's per-signature cap has a reset loophole: a fixer that changes the failure mode (wrong total → no confirmation) would mint a new signature and restart the count. Fix with **two caps, both enforced**:

```
signature = hash(objective_hash + failing_step)   // 15 Nov: remark is NEVER hashed
attempts[signature] += 1 on each APP_BUG dispatch
attempts_per_claim += 1        // per PROVISIONAL_DONE, never resets on signature change
if attempts[signature] > 3 or attempts_per_claim > 5:
    state = HUMAN_BLOCKED; no 4th run; console shows the 3 failures + credits
```

**15 Nov correction — signature normalisation (user panel HIGH).** The earlier draft hashed
the verbatim Kane `remark` into the signature. Real Kane remarks are LLM-generated and vary
between the first red and the confirm replay — the second red would mint a new signature,
the pending red would never match, and the fixer would never dispatch (replay livelock,
bounded only by the per-claim cap). The signature is now `hash(objective_hash + failing_step)`
only; the remark is recorded in the journal but never hashed.

**Replay cap (15 Nov, principal engineer #5).** At most **2 replays without a fixer dispatch**
per claim, then `HUMAN_BLOCKED` — even if every replay is a different failure. The count resets
to 0 on a fixer dispatch (a fix is progress). This bounds the signature-normalisation livelock
from the other side.

**State persistence (15 Nov, principal engineer #5).** Gate state is persisted to `state.json`,
derived from `journal.jsonl` — restarting the watcher restores attempt counts, pending reds,
and replay counts, so a restart cannot reset the caps.

`HUMAN_BLOCKED` is a visible terminal state, not a log line: status strip, console banner, and journal entry. Only a human clearing the state (new `PROVISIONAL_DONE` with a changed objective hash) re-arms it. Flake replays, `DIDNT_START`, and `TEST_BUG` fixes never consume app attempts.

## 6. Green-twice — corrected definition (Wave 2 engineers)

Wave 1's "green twice (same saved test)" is vacuous: replaying the same recording twice proves determinism, not correctness. Redefine:

```
GREEN = replay_pass AND independent_pass
  replay_pass:     testmd run of saved _test.md, --no-adaptive-heal, exit 0 + terminal passed
  independent_pass: fresh kane run (O2 chaos sweep), different wording, different cart
                   (different products/quantities/discount), expected total
                   computed independently in the objective — NOT copied from app code
```

Two identical replays count as *one* pass plus a flake filter. The independent sweep runs **only after a replay pass**, so it is paid for once per genuine fix, not per attempt. Only `GREEN` lets the verifier write `LOOP_VERIFIED`.

**15 Nov correction — the live loop now spawns the sweep.** The first live implementation spawned exactly one `testmd` replay per save and handled only the `fixer` decision: a `replay` decision triggered nothing (no re-spawn, no timer) and nothing ever spawned the O2 sweep, so `LOOP_VERIFIED` was unreachable in live mode. `runLiveGate` now loops until a terminal state (replay → re-spawn to confirm; fixer → re-spawn the replay to prove the fix; replay pass → O2 sweep via `kane run`; sweep pass → `LOOP_VERIFIED`), bounded by the gate's caps plus a 12-spawn cap per save-triggered run. A `sweepMode: 'local'` fallback runs the local deterministic probes and labels the pass LOCAL-SWEEP, never as a Kane run. Tested with a mocked Kane spawn (`kane-watch/test/run-live-loop.cjs`).

## 7. Replay-first

Author each flow once with `kane run --name <slug>`; commit `output-<slug>/` and the `_test.md`. Every loop iteration is `testmd run tests/<slug>_test.md --agent`. **Gate runs always pass `--no-adaptive-heal`** — but **verify this flag exists on `testmd run` in the pinned 0.10.3 on Day 1**; it is a `testmd run` / `testrun run` flag only ("Turn off adaptive healing after a replay failure") and does NOT apply to a fresh `kane run`. If it exists only elsewhere, the gate must use `kane run` with the saved test, or disable adaptive healing in config — and the README must say which. Healing is on by default: after a replay failure it retries up to three smaller windows, then re-authors authorable steps. A healed test masking a regression destroys Verified.

**Fresh `kane run` is for authoring and for the independent sweep only.** `testrun run` is for two or more saved tests (one summary, one exit code, one evidence pack) — do not loop `testmd run` in bash.

## 8. Independent second check + anti-cheat

Static diff scan (§4) is necessary, not sufficient — a hard-coded total passes a static scan if written plausibly. The real anti-cheat is dynamic: the independent sweep (O2) uses unseen inputs (different quantity, different discount code, different product mix), so a hard-coded total or a deleted discount branch fails it. **Add a mutation check on 16 Nov:** deliberately hard-code the total and delete an assertion — both must be caught, one by the diff scan, one by the sweep. No shared fixtures between the two checks beyond the seeded LoopMart catalogue; different objective text, different expected values.

**Diff-scoped objectives (Wave 2 researchers' addition):** the gate derives its objectives from the git diff (pre-commit / on-save diff → objectives scoped to what changed), and on failure can **auto-bisect** — walk back through commits to find the one that broke Kane. GuardianKane never answers "which commit broke it"; this is the best unoccupied differentiation available. Implement diff-scoping on 14 Nov if the core gate is green; bisect is a 15–16 Nov stretch goal, not a core requirement — do not let it delay the gate.

## 9. Credit budgeting — relative, not absolute (Wave 2 correction)

Wave 1's warn ~250 / stop ~400 assumes the unverified 1,000. If the balance is actually 10,000 those thresholds waste headroom; if a fresh run costs 200, they blow the budget in two runs. **Day 1 must measure:** one fresh author run, one replay, one independent sweep — record `credits_consumed` for each from `run_end`.

```
balance0 = kane-cli balance at kickoff (record it; do not assume 1000)
reserve  = cost(final evidence: 1 fresh + 2 replay + 1 sweep) + 20%
warn_at  = balance0 - reserve - 25% of (balance0 - reserve)
hard_stop: spent >= balance0 - reserve   // never spend the reserve
before each FRESH run: if projected spend > remaining - reserve: refuse, log CREDIT_BLOCKED
replays are ~0 by FAQ claim — verify Day 1; if a replay consumes credits,
  the whole replay-first budget is wrong and scope must shrink to one flow
```

Publish the measured unit costs in the README. **Pre-record the video runs early if the budget is tight** — do not burn the reserve re-shooting. The console shows credits as text (see `04`): per-run, session total, and budget, with a text warning at the warn threshold and a stop note at the hard stop. No colour-only bar.

**Budget table to fill in on Day 1 (12 Nov):**

| Item | Measured credits (fill in) |
|---|---|
| One fresh author run (O1) | |
| One replay (O1 `testmd run`) | |
| One independent sweep (O2 fresh) | |
| One paired-experiment run (O4) | |
| Final evidence (1 fresh + 2 replay + 1 sweep) + 20% = reserve | |
| `balance0` (from `kane-cli balance`) | |
| Warn threshold / hard stop (computed from the above) | |

## 10. Evidence journal schema

Append-only JSONL, one line per run, never hand-edited; `state.json` is **derived from it, never the source of truth**:

```
{ run_id, loop_id, timestamp, trigger,            // save | break-it | manual | replay
  git_sha_before, git_sha_after, dirty_before,    // dirty => unreproducible flag
  objective_hash, test_file_hash, signature,
  classifier, attempt_no, attempts_per_claim,
  exit_code, terminal_event, status,             // run_end | test_md_done | none
  credits_consumed, duration_ms,
  test_url, session_dir, evidence_path,          // red+green run_end JSON, screenshots
  verdict,                                        // PROVISIONAL_DONE | LOOP_VERIFIED | HUMAN_BLOCKED | CHEAT_REJECTED
  notes }
```

- `run_id` is `YYYYMMDD-HHMMSS-<seq>`; `evidence_path` points at the curated `evidence/` folder (red + green `run_end` JSON, 2–3 screenshots, `test_url` links). Raw NDJSON stays gitignored under `.testmuai/`.
- The journal is rendered as a static page (see `04` §5) — a judge must be able to replay the suite in <30s from the README and see fail-then-green without running the video.
- **Paired experiment (O4):** log the gated and ungated runs in the journal with `loop_id` distinguishing them, so the comparison is evidence, not a claim.

## 11. NDJSON parser tolerance + Day 1 fixture tests

```
for each line: strip; skip blank; try JSON parse; on failure keep
  raw line + byte offset in a corrupt-lines list, continue
  // a truncated final line on timeout is expected, not fatal
dispatch on event type: known types handled; unknown types counted
  (unknown_type_count in journal) and ignored — never crash, never
  treat an unknown type as terminal
  // 15 Nov (principal engineer #7): whitelist the known typed events
  // (stream_start, error, warning, bifurcation, child_agent_start/end,
  // ask_user, recording_state, project_folder_auto_defaulted) instead of
  // counting them unknown; step events WITH a type field also set the
  // failing step (earlier only typeless events did — a real failed run
  // could have classified DIDNT_START)
coerce result_code with Number() — strict === 740 misses the string "740"
terminal event: run_end for `kane run`; test_md_done for `testmd run`
  // accept either, but record which one terminated the run; a run
  // that ends on the WRONG terminal type for its command is INCONCLUSIVE
  // `done` is an assurance-stream terminal only — on run/testmd/testrun
  // it is the wrong terminal type, so INCONCLUSIVE
exit-code-first: exit != 0 overrides any optimistic stream reading;
  exit == 0 with no terminal event is INCONCLUSIVE, never PASS
  // ...except: trust run_end.status / result_code / verdict OVER the
  // exit code when both are present (see §3 — exit codes lie)
  // exit 3 means cancelled-only for testrun (INCONCLUSIVE), not
  // FLAKE_OR_TIMEOUT for all commands (15 Nov, principal #7)
```

**Pin the CLI version and fixture-test the parser Day 1 against:**
1. A 0.9.0 `run_end` stream.
2. A `test_md_done` stream.
3. A truncated timeout stream.
4. A stream with an unknown event type injected.
Any parser change after Day 1 requires re-running all four fixtures.

## 12. Local vs deployed target — decide Day 1

The loop cannot wait on a Vercel deploy per fix. **Rule: loop runs against a local preview server rebuilt per attempt (fast, deterministic); final verification + judge replay run against the canonical deployed URL.** The README must state both targets, and the deploy step must be scripted, not manual, or the 16 Nov clean-clone test will fail.

## 13. Failure modes to test on 16 Nov (hardening day — all must pass or scope is cut with reasons recorded)

1. **Flaky-red injection:** force a one-off red (e.g. transient element timing) — expect replay green, zero code change, zero attempt consumed, journal shows `FLAKE → replay → PASS`.
2. **Unfixable bug:** seed a bug the fixer cannot fix (e.g. totals computed server-side from a wrong constant outside the allow-list) — expect exactly 3 app attempts, then `HUMAN_BLOCKED`, no 4th run, credits logged.
3. **Signature-change evasion:** fixer changes failure mode on attempt 2 — expect the per-claim cap (5) to stop it even though the signature changed.
4. **Cheat — hard-coded total:** patch returns the expected total literally — expect diff-scan rejection or independent-sweep failure; never `LOOP_VERIFIED`.
5. **Cheat — deleted assertion / test edit:** patch touches `*_test.md` or deletes a discount branch — expect gate rejection, rollback to `sha_before`, `CHEAT_REJECTED` in journal.
6. **Cheat — healed test (negative control):** run the gate with adaptive heal enabled — expect it to mask the seeded bug, proving why `--no-adaptive-heal` is load-bearing; then confirm the real gate blocks it.
7. **Parser edges:** truncated timeout stream, unknown event type, `test_md_done` on a `kane run` invocation and vice versa, exit 0 with no terminal event — expect `INCONCLUSIVE`, never a false pass.
8. **Exit-1 upload failure:** simulate a run where the app passes but evidence upload fails — expect `DIDNT_START`, not `APP_BUG`, no fixer dispatch.
9. **Debounce/single-flight:** five saves in 3s — expect exactly one Kane run; a save mid-run — expect exactly one coalesced follow-up run, never two concurrent.
10. **Watcher self-trigger:** a journal/state write must not start a run; a `_test.md` edit must not start a run.
11. **Credit stop:** set a test balance low — expect `CREDIT_BLOCKED` before a fresh run, reserve untouched, replay still allowed.
12. **Clean-clone + no-Kane-login:** fresh clone, no sign-in — expect the app serving in <30s and recorded red→green evidence visible; no crash, no hang waiting on auth.
13. **`Break it` determinism:** deterministic seeded bug on/off — expect the same failure signature every time, and a clean restore that replays green with no journal corruption.

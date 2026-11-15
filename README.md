# Kane Loop — a veto gate for AI coding agents

> **A watcher any agent can install in one command, that blocks on a diff, not on a claim.** The coding agent's "done" is provisional; only a separate verifier process can mark a change verified — after replaying the committed `_test.md` suite **and** an independent chaos/defect sweep in which Kane derives the expected total itself.

Built for the **TestMu Kane CLI Online Hackathon** (12–19 Nov 2026, $3,000 in prizes).
Submission deadline: **19 Nov 2026, 23:59 IST (18:29 GMT)** — confirmed on the Luma page and by organiser email, 12 Nov 2026.

## What it is

`kane-watch` — a file watcher / save hook that fires Kane CLI, parses the NDJSON run, classifies the result, and (only for a genuine app bug, confirmed twice) applies a validated reference patch for the bug class itself — the loop is the agent side. The fixed-format FIX PROMPT is the audit record of the failure the patch addresses (failing step, remark, allow-listed files), emitted to stdout and the journal; it is not sent to an external agent. (15 Nov correction: the earlier wording said the gate "hands a minimal fix prompt to the coding agent", but no external agent is ever invoked.) The agent cannot self-certify.

- **Veto gate, not a watcher:** the agent's `PROVISIONAL_DONE` means nothing until the verifier writes `LOOP_VERIFIED` (replay pass **and** independent sweep pass).
- **Caps:** 3 attempts per failure signature **and** 5 attempts per claim, then a visible `HUMAN_BLOCKED` state. No 4th run.
- **Anti-cheat:** a fix that deletes an assertion, hard-codes a value, or edits a test is rejected and rolled back.
- **Verdict over exit code:** the classifier trusts `run_end.status` / `result_code` / `verdict` over the process exit code. A confirmed product bug arrives as `result_code` 740.
- **Credit budgeting:** thresholds are computed from the *measured* Day 1 balance, not from the advertised 10,000. See `docs/credit-budget.md`.
- **Confirm-before-fix:** a first red triggers a replay (~54 credits measured — the "zero-credit replay" design assumption was wrong; replays cost about the same as a fresh run) before any code change. Only a second identical red dispatches the fixer.

Unlike the official Kane skill, which runs a flow once and reports, Kane Loop adds a committed `_test.md` suite replayed instead of re-authored (objectives in `tests/objectives/`; the `_test.md` files are authored by live runs — `loopmart-o1-core-5/6_test.md`, `loopmart-chaos-sweep_test.md` — see the console for the live evidence), credit budgeting against the measured account balance, 3-attempt escalation (plus a per-claim cap of 5) to a visible human-blocked state, an independent chaos sweep in which Kane derives the expected total itself, and anti-cheat — with verdict-based gating on `result_code` 740. GuardianKane (August 2nd place) is prior art: it is a Claude Code Stop-hook gate; Kane Loop is an agent-agnostic watcher that gates on the git diff, and LoopMart is a disposable victim, not the product.

**Not implemented (stretch goals, not claims):** diff-scoped objectives and auto-bisect — named in early planning, zero code exists. They are not part of the entry as built.

## The demo victim: LoopMart

A tiny single-page checkout — 3 products, cart, discount, fake pay, order confirmation, visible order ledger. 4 clicks, no auth, no login, deterministic.

| Product | Price |
|---|---|
| Loop Mug | £15.00 |
| Debug Hoodie | £35.00 |
| Kane Notebook | £10.00 |

Core flow: Mug + Hoodie = £50.00 subtotal, discount code **KANE10** (10% off) = −£5.00, total **£45.00**. Pay → confirmation shows `Total paid £45.00`, order `LOOP-1001`, exactly one ledger order, stock decremented by exactly 1 each.

**Seeded bug (disclosed as seeded):** double-charge on double-click Pay — the same order is charged twice, the ledger shows two orders, stock decrements twice, a second confirmation is issued. The canonical trigger is double-clicking during the ~1s Processing state; a retry after a confirmation is unreachable in a real browser and is not a trigger (15 Nov correction). The cart total stays correct (£45.00): the checkout *looks* done while the money is wrong underneath. Full spec: `docs/loopmart-spec.md`.

## 30-second judge path (works now, no Kane sign-in, no credits)

All of this runs locally today — nothing below needs a live Kane run:

1. `npm run demo` — serves the Loop Console at `http://localhost:8080/` (root is the console; the checkout is embedded in it). The header says what this is: "Kane Loop — a watcher any agent can install in one command, that blocks on a diff, not on a claim."
2. Click `Break it — apply the double-charge bug`: the console arms the bug, prefills Mug + Hoodie + KANE10, and reproduces the scenario locally (double-click Pay, no Kane run starts from this button). With the fix shipped the guard proves one charge; live Kane runs are in the console timeline.
3. `npm run dry-run` — the full loop closes end-to-end on the seeded-bug fixture: fail → patch → green (replay + independent sweep), `LOOP_VERIFIED`, journal written to `journal.jsonl`. No sign-in, no credits, labelled dry-run throughout.
4. `npm test` — the full suite (see Status — Day 3 for the counts).

## Live runs (landed 15 Nov 2026 — see Status — Live runs)

- The `_test.md` files are authored (`loopmart-o1-core-5/6_test.md`, `loopmart-chaos-sweep_test.md`); replay them with `kane-cli testmd run tests/<slug>_test.md --agent --headless --no-adaptive-heal`.
- `kane-watch` (live mode) watches `loopmart/` and runs the real gate on save; the live runs so far were manual `kane-cli run` invocations against the deployed URL (see console timeline). The watcher firing the gate on a save end-to-end has not run yet — the loop wiring is tested with a mocked spawn (`kane-watch/test/run-live-loop.cjs`, 4/4).
- Deployed to Vercel: https://kane-loop-loopmart.vercel.app/ (15 Nov, Drop to Deploy; root redirects to the console).

## Status — Day 1 (12 Nov 2026)

- [x] Kane CLI pinned: **0.10.4** (`npm view` + `kane-cli --version`, 12 Nov). 0.10.3 was the 9 Nov latest; 0.10.4 supersedes it.
- [x] Flags verified on 0.10.4: `--agent` (run + testmd run), `--no-adaptive-heal` (testmd run only), `--bug-detection off|stop|continue` (run + testmd run), `--analyzer-only` / `--condition`.
- [x] NDJSON parser fixture tests pass (9/9 — see `kane-watch/test/`).
- [x] LoopMart spec + Kane objectives frozen (`docs/`).
- [x] **TestMu sign-in — DONE 15 Nov.** `kane-cli whoami` reports authenticated (ollymcbride4, OAuth via the browser relay); 10,000 credits claimed via the organiser link (balance 9,723.47 after 476.53 spent 15 Nov).
- [x] Credit budget — measured, not relative (`docs/credit-budget.md`): fresh runs ~50–76 credits, replays ~54. Balance 9,723.47; reserve 250.

## Status — Day 2 (13 Nov 2026)

- [x] LoopMart built end-to-end (`loopmart/`): 3 products, cart, KANE10, fake pay, confirmation, visible ledger + stock. Serves locally (`npm run demo`, port 8080); Vercel config in `vercel.json` (deploy Sat 15 Nov, not today).
- [x] Seeded double-charge regression active by default (`?mode=buggy`); `?mode=fixed` restores correct behaviour. Verified deterministically: double-click Pay → 2 ledger orders, stock −2 each, second confirmation (LOOP-1002); single Pay → 1 order, stock −1 each. A1–A3 still pass with the bug active; A4/A5 fail — the checkout *looks* done while the money is wrong underneath.
- [x] Failure classifier + gate state machine + fix contract + credit guard + journal (`kane-watch/src/classifier.js`); debounce + single-flight runner with dry-run mode (`kane-watch/src/runner.js`). Live Kane runs landed 15 Nov (see Status — Live runs).
- [x] Tests: `npm test` — 9/9 parser fixtures, 15/15 classifier/gate/runner, 12/12 LoopMart logic, 9/9 DOM wiring (45 total), all passing.
- [x] First live Kane runs — DONE 15 Nov: O1 caught a real timer bug live (740, Pay stuck on Processing), then passed after the fix (100); O2 caught the seeded double-charge live (740, 2 orders), then green after the fix (100). See Status — Live runs.

## Status — Day 3 (15 Nov 2026)

- [x] Dry-run end-to-end loop entry point (`kane-watch/kane-watch.js`): `--dry-run` drives the real wiring (parse → classify → confirm replay → fixer → replay → sweep → `LOOP_VERIFIED`) on the seeded-bug fixture. Acceptance verified 15 Nov: `node kane-watch/kane-watch.js --dry-run kane-watch/test/fixtures/seeded-double-charge.ndjson` → exit 0, `DRY-RUN LOOP_VERIFIED`. The live loop is now complete and tested end-to-end with a mocked Kane spawn (`kane-watch/test/run-live-loop.cjs`, 4/4): a `replay` decision re-spawns Kane to confirm, a fixer dispatch re-spawns the replay to prove the fix, and a replay pass spawns the O2 sweep via `kane run` — `LOOP_VERIFIED` closes in live mode too. The live spawn path uses the real arg builder (`kane-cli testmd run … --agent --headless --no-adaptive-heal --bug-detection continue --timeout 120 --url …`), so a real run plugs in with zero code change when auth lands. What a real run still has to prove is the real CLI's NDJSON/credit behaviour, not the loop wiring.
- [x] Fixer (`kane-watch/src/fixer.js`) + sweep (`kane-watch/src/sweep.js`): bounded patcher (allow-list `loopmart/**`, ≤30 lines, ≤3 files, no test edits, no hard-coded totals, rollback on rejection) with two strategies — the seeded double-charge class and G1 (ledger preserved across "Start new order", added 15 Nov fix round); sweep derives the expected total itself from hardcoded spec prices (Mug £15, Hoodie £35, Notebook £10 — 2× notebook + 1× mug, KANE10) with inputs distinct from the replay.
- [x] Loop Console (`loopmart/console.html` + `console.js`): header + claim + sticky strip, latest-run card (live O2 green run), 10-run live timeline, `Break it` / `Replay` buttons, credits display (476.53 spent 15 Nov, balance 9,723.47), live `run_end` behind a disclosure. Served with LoopMart on the same screen; root `/` serves the console.
- [x] Hardening (council findings, all verified by tests): signature normalised to (objective hash + failing step) — remark never hashed; missing-element remarks → INCONCLUSIVE unless 740 confirms; 740 + `passed` status → INCONCLUSIVE; gate provenance required for `LOOP_VERIFIED` (sweep must be a different run with different inputs from the replay); replay cap 2 without a fix, then `HUMAN_BLOCKED`; gate state persisted to `state.json` derived from `journal.jsonl`; server crash fix (malformed URL → 400, traversal + extension hardening); debounce starvation fix (firstSave null sentinel, reset on run start); spawnKane settled guard; cart guards (empty-cart pay, qty clamp, NaN, discount freeze); pay-form validation; accessibility pass (aria-labels, aria-live, focus management, skip link, `<main>`, `<noscript>`); stock render fix; double-charge anomaly flag; empty-cart Pay state; charge lands at end of Processing (ledger and confirmation never disagree mid-flight).
- [x] One-command install: `bin` entry `kane-watch` in `package.json` — verified 15 Nov with a local prefix install (`npm install -g --prefix /tmp/kw-install .` → `/tmp/kw-install/bin/kane-watch --help` and `--dry-run` both work). The public form is `npm install -g github:OlsOls4/kane-loop` once the repo is pushed — that form itself is unverified until the push.
- [x] Tests: `npm test` — 9/9 parser fixtures, 17/17 classifier/gate/runner, 16/16 LoopMart logic, 17/17 DOM wiring, 13/13 fixer/sweep, 4/4 chaos sweep, 15/15 hardening, 2/2 loop end-to-end, 4/4 live loop (**97 total**), all passing.
- [x] Objectives files: `tests/objectives/loopmart-checkout.objective.md` (O1) and `tests/objectives/loopmart-chaos-sweep.objective.md` (O2), verbatim with the 15 Nov retry correction; `tests/README.md` (no hand-authored `_test.md`).
- [x] Video script (honest fallback cut, `docs/video-script.md`, ~375 words, 2:50 + 5s buffer) + Tier B drop-ins (`docs/video-tier-b-dropins.md`) + shot list (`docs/shot-list.md`) + submission paragraph (`docs/submission-paragraph.md`) + X drafts (`docs/x-post-2.md`, `docs/x-launch-thread.md`).
- [x] **Vercel deploy — DONE 15 Nov.** https://kane-loop-loopmart.vercel.app/ (Drop to Deploy, 3 deploys that day; root redirects to the console). The `vercel` binary in this VM is an MCP-server bridge, not the deploy CLI — deploys go through the browser Drop to Deploy flow.
- [x] **First live Kane runs — DONE 15 Nov (see Status — Live runs).** O1 caught a real timer bug live (740), then passed after the fix (100); O2 caught the seeded double-charge live (740), then green after the fix (100). Replay leg unproven: Kane's replay analyzer failed 3× (confirmed false).
- [ ] Genuine bug retained (Judge B #3): **G1 — "Start new order" wipes the ledger** (`reset()` clears `orders`, contradicting spec §3.4). Kept as a disclosed genuine defect; the sweep's ledger probe fails by design and is excluded from GREEN. The console names it where a judge sees it ("Known defect G1 — Kane's next catch", in the confirmation block next to the "Start new order" button), and the fixer now has a one-line G1 strategy (added 15 Nov fix round), so the loop can fix it the moment Kane catches it live. See Known issues.

## Status — Live runs (15 Nov 2026, afternoon)

All runs against https://kane-loop-loopmart.vercel.app/index.html. Full log:
`hidden_files/first-live-run-2026-11-15.md` (goal workspace); NDJSON in `evidence/`.

| Run | Result | result_code | Credits | What happened |
|---|---|---|---|---|
| O1, first live run ~15:11 | failed | 740 (confirmed) | 50.37 | Pay stuck on Processing — a REAL timer bug (`setTimeout` detached from `window`), not the seeded one. Checkout 100% broken in a real browser. |
| O1 replay ~15:20 | failed | 740 (confirmed) | 53.88 | Same timer bug, reproduced identically. A replay costs ~54 credits, same as a fresh run. |
| O1 re-run ~15:40 | passed | 100 | 56.59 | Timer fix works: 23 steps, Pay completes, 1 order, stock −1. |
| O2 chaos sweep ~15:46 | failed | 740 (confirmed, 0.99) | 75.71 | Seeded double-charge caught live: double-click Pay → 2 charges (LOOP-1001, LOOP-1002), stock −4. |
| O1 green, fresh ~16:09 | passed | 100 | 53.69 | 1 order, stock −1. |
| O2 green, retry ~16:14 | passed | 100 | 49.73 | Double-click Pay → exactly 1 order (LOOP-1001), stock −2. Seeded bug FIXED in a real browser. |
| O1 replay ×3 (~16:05, ~16:05, ~16:16) | failed | — (analyzer_failed, confirmed false) | 2.39 / 2.15 / 2.74 | Kane-side analyzer fault (steps 2, 2, 18), not the app. The literal replay leg is unproven. |

**Verdict: GREEN in substance, NOT literal.** Prep/03 defines GREEN as replay_pass AND independent_pass — the replay leg never passed, so the literal definition is unmet. The substance is proven: the fresh O1 pass (100) + the independent O2 sweep pass (100). Fixes shipped between the reds and greens: timer bind (app.js) and single-flight + idempotency (28 lines, 2 files). Balance after the day: 9,723.47 (10,200 → 9,723.47, 476.53 spent).

## Status — Day 3 fix round (15 Nov 2026, fresh re-score)

One HIGH defect plus smaller ones, all fixed this round (see `hidden_files/build-log-2026-11-15-wave3.md`, addendum):

- [x] **Live loop can close (HIGH):** `runLiveGate` now loops until a terminal state — a `replay` decision re-spawns Kane to confirm, a fixer dispatch re-spawns the replay to prove the fix, and a replay pass spawns the O2 sweep via `kane run` (`buildKaneArgs` sweep branch). A `sweepMode: 'local'` fallback runs the local probes and labels the pass LOCAL-SWEEP, never as a Kane run. Tested end-to-end with a mocked Kane spawn (`run-live-loop.cjs`, 4/4) — the "zero code change" claim is now true of the loop wiring; only the real CLI's NDJSON/credit behaviour is unproven.
- [x] **Fixer honesty:** the loop applies a validated reference patch for the bug class itself (the loop IS the agent side); the FIX PROMPT is the audit record, not a handoff to a coding agent. README + `docs/loop-design.md` reworded.
- [x] **G1:** fixer gains a one-line G1 strategy (`reset()` preserves the ledger); the console names G1 next to "Start new order". G1 stays unfixed in the shipped code so Kane has a real bug to catch.
- [x] **Evidence hygiene:** dry-run journal lines record the parsed fixture credits (14 on the red lines), not a hardcoded 0; traversal status corrected (see build log); journal regenerated fresh (exactly 5 lines).
- [x] **Sweep independence:** expected prices are hardcoded from the spec (Mug £15, Hoodie £35, Notebook £10), not read from `LM.PRODUCTS` — a 1p price-table tamper now fails the independent-total probe.
- [x] **Watcher scope (known limitation, not fixed):** the watcher is hardwired to `loopmart/` and the gate is LoopMart-specific — see Known issues. No `--watch` flag was added, because watching another directory would run LoopMart's O1 gate against unrelated code.

**Remote staleness note:** the pushed remote README still says parser "7/7" and maps `app/` — both were already corrected locally (9/9, `loopmart/`) and will be fixed on the remote when the coordinator pushes.

## Install & run

Install kane-watch (one command — verified locally 15 Nov; the GitHub form works once the repo is pushed):

```sh
npm install -g github:OlsOls4/kane-loop
kane-watch --help
kane-watch --dry-run kane-watch/test/fixtures/seeded-double-charge.ndjson   # closes the loop, no sign-in, no credits
```

Install Kane CLI (needed for live runs only):

```sh
npm install -g @testmuai/kane-cli@0.10.4
kane-cli whoami        # must show signed in
kane-cli balance       # record the number; do not assume 10,000
kane-cli config show
npm run demo           # serves LoopMart + console locally (port 8080)
```

Preflight fails fast with a human-readable fix when sign-in, balance, or config is missing. Loop runs target the local preview server rebuilt per attempt; final verification and judge replay target the canonical deployed URL.

## How the loop works

See `docs/loop-design.md` (classifier, fix contract, caps, green-twice = replay **and** independent pass, confirm-before-fix, journal schema) and `docs/kane-objectives.md` (objectives O1–O5 verbatim).

## Evidence

`evidence/` holds the raw NDJSON + stderr for every live Kane run (15 Nov 2026), each containing its `run_end` with `result_code` and `test_url`. The console timeline (`loopmart/console-data-live.json`) links the Test Manager `test_url` per run. Raw NDJSON stays local-only: `evidence/` is gitignored, as are saved tests and sessions under `.testmuai/`. The run journal (`journal.jsonl`) is append-only; `state.json` is derived from it, never the source of truth.

## Repo map

```
docs/            frozen spec + objectives + design + console/video + risks (Day 1)
kane-watch/      the veto-gate watcher (src/ + test fixtures)
loopmart/        LoopMart checkout (cart.js logic, app.js wiring, index.html, server.cjs)
tests/           committed _test.md suite (authored once with `kane run --name`)
evidence/        curated red/green evidence packs
journal.jsonl    append-only run journal
```

## Known issues

- **G1 (genuine, disclosed): "Start new order" wipes the ledger.** `reset()` clears `orders`, contradicting spec §3.4 ("every completed order is appended to a visible ledger"). Kept deliberately as the one genuine defect alongside the disclosed seeded bug (Judge B #3) — the loop can catch it, and the sweep's ledger probe fails by design and is excluded from GREEN. The console names it in the confirmation block next to the "Start new order" button ("Known defect G1 — Kane's next catch"), and the fixer has a one-line strategy for it (`g1-ledger-preserve`, added 15 Nov), so the loop fixes G1 the moment Kane catches it live. It is left unfixed in the shipped code so Kane has a real bug to catch.
- **Watcher scope (known limitation):** the watcher is hardwired to `loopmart/` and the gate (objective O1, `_test.md` replay, fixer strategies) is LoopMart-specific. "Install in one command" installs the watcher; it does not make the gate work on an arbitrary repo. A `--watch <dir>` flag was deliberately not added — watching another directory would run LoopMart's O1 gate against unrelated code. Generalising the gate is a post-hackathon stretch goal, not a claim.
- No PRD tracker, no secret scan, no file locking (those are GuardianKane's). No `kane-cli explore` (Max plan only).
- Kane flakiness is handled by confirm-before-fix replay, never by editing a test to match a bug.
- Video (≤3 min, Olly-voiced, manual captions) and submission (SurveyMonkey, ~10:00 GMT 19 Nov) are human-gated steps — see `docs/risks-and-checks.md`.

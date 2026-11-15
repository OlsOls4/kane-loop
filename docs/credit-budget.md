# Kane Loop — Credit Budget (Day 1, 12 Nov 2026; Day 2 note, 13 Nov)

**Status:** THRESHOLDS DEFINED, MEASUREMENTS PENDING. `kane-cli balance` cannot run until Olly signs in to TestMu (`kane-cli whoami` = not logged in, token missing). No credits have been spent. Do not assume 1,000 (dashboard, 9 Nov) or 10,000 (advertised).

**Day 2 (13 Nov):** no change. No live Kane run was made (auth/credits unresolved — see README Status). Zero credits spent. The harness measures `credits_consumed` from every `run_end` the moment the first authenticated run happens; until then every row below stays PENDING. The classifier + runner were tested against synthetic NDJSON only — no cost was incurred, because no Kane run was started.

## Measured unit costs (fill in after the first authenticated run)

| Item | Measured credits |
|---|---|
| One fresh author run (O1) | PENDING — needs sign-in |
| One replay (O1 `testmd run`) | PENDING — needs sign-in |
| One independent sweep (O2 fresh) | PENDING — needs sign-in |
| One paired-experiment run (O4) | PENDING — 15 Nov |
| Final evidence (1 fresh + 2 replay + 1 sweep) + 20% = reserve | PENDING (computed from above) |
| `balance0` (from `kane-cli balance`) | PENDING — needs sign-in |
| Warn threshold / hard stop | PENDING (computed from above) |

## Rules (from `docs/loop-design.md` §9 — relative, not absolute)

```
balance0 = kane-cli balance at kickoff (record it; do not assume 1000)
reserve  = cost(final evidence: 1 fresh + 2 replay + 1 sweep) + 20%
warn_at  = balance0 - reserve - 25% of (balance0 - reserve)
hard_stop: spent >= balance0 - reserve   // never spend the reserve
before each FRESH run: if projected spend > remaining - reserve: refuse, log CREDIT_BLOCKED
```

- Replays are ~0 LLM credits *only if unchanged* — any re-authored/healed step costs. Budget assumes heal/re-author costs.
- Author each flow ONCE with `kane run --name`, then loop on `testmd run` replay. Never burn a fresh run to re-check something a replay can answer.
- If a replay consumes credits on Day 1, the whole replay-first budget is wrong: shrink scope to one flow and one fresh verification run, and rewrite this budget.
- Pre-record the video runs early if the budget is tight — do not burn the reserve re-shooting.

## Planned fresh runs (3 authoring + 1 sweep per genuine fix)

| Objective | Slug | When |
|---|---|---|
| O1 core checkout | `loopmart-checkout` | Author once (12–13 Nov) |
| O2 chaos sweep | `loopmart-chaos-sweep` | Author once; fresh run once per genuine fix (after replay pass) |
| O4 paired experiment | `loopmart-ungated` | Once, 15 Nov |
| Final evidence | — | 18 Nov (1 fresh + 2 replay + 1 sweep) |

Everything else is replay. Total fresh authoring runs to budget for: 3 + 1 sweep per genuine fix + final evidence runs.

## Day 3 note (15 Nov 2026)

Still **PENDING** — no authenticated Kane run has been made, so the balance is still
unknown and **0 credits have been spent**. The dry-run loop, the fixer, the sweep, and
all 87 tests ran with zero Kane credits (fixture NDJSON only). The O4 paired experiment
planned for 15 Nov has not run (needs auth + credits). Nothing in this budget has been
measured yet; every figure above remains a relative threshold, not a measured cost.

## MEASURED — Sun 15 Nov 2026 (first live runs; see hidden_files/first-live-run-2026-11-15.md)

Auth: CLI logged in as ollymcbride4 (OAuth relay), balance **10,200** at 14:58.
Target: https://kane-loop-loopmart.vercel.app/index.html (Vercel project
kane-loop-loopmart). Chrome: Playwright Chromium via local CDP + a localhost
CONNECT forwarder to the VM egress proxy (see run log for the setup — the CLI
does not pass proxy flags to Chrome, and the VM's NO_PROXY list broke the CLI's
parser until sanitised).

| Item | Measured credits (run_end) | Balance before → after |
|---|---|---|
| Failed setup run 1 — browser no network (ERR_TUNNEL_CONNECTION_FAILED), 37.8 s | 13.09 | 10,200 → 10,183.19 |
| Failed setup run 2 — cert invalid (ERR_CERT_AUTHORITY_INVALID), 60.4 s | not recorded (file overwritten) | 10,183.19 → 10,166.88 |
| **One fresh author run (O1)** — 20 steps, 180.5 s, status failed, result_code 740 | **50.37** | 10,166.88 → 10,088.34 |
| **One replay (O1 `testmd run`, --no-adaptive-heal)** — 181 s, overall_status failed | **53.88** | 10,088.34 → 10,030.60 |
| **Balance now** | — | **10,030.60** |
| **Total spent (balance deltas)** | — | **169.40** |

Balance deltas exceed run_end credits by ~4 per run (13.09 vs 16.81; 50.37 vs 78.54;
53.88 vs 57.74) — the O1 gap is the largest and probably includes late settlement
of the previous failed run. Treat run_end credits as the per-run figure and the
balance as the ground truth for what is left. Do not reconcile the gap by
invention; re-check it on the next run.

### ⚠️ The replay assumption is WRONG — budget rewritten

The prep assumed replays cost ~0 LLM credits if unchanged. **Measured: a replay
costs 53.88 credits — the same order as a fresh author run (50.37).** The
"tests cache on first run, replay at zero cost" claim does not hold in practice
for this CLI/account. Every loop iteration therefore costs ~50 credits, not ~0.
The replay-first budget is rewritten accordingly (per the rule in this file):

- Unit cost per iteration (fresh or replay): **~50–55 credits**.
- Final evidence reserve: 1 fresh (~50) + 2 replays (~54 × 2) + 1 sweep fresh
  (~50) ≈ **208 + 20% ≈ 250 credits**.
- Usable now: 10,030.60 − 250 reserve ≈ **9,780 credits ≈ ~185 iterations**
  at current unit cost. Budget is NOT tight; no scope shrink is needed.
- warn_at: remaining ≈ 2,700 (balance 2,950). hard_stop: remaining ≈ 250
  (never spend the reserve).
- The long durations (180 s) are dominated by the confirmation waits on the
  failing Pay — a fixed Pay should shorten runs sharply and may cut unit cost.
- Sunk env-fix cost: ~33 credits burned on the two failed setup runs before
  any real test ran. The Chrome/proxy setup is now documented in the run log
  so it is not paid for twice.

### What the O1 run actually found

Not the seeded bug. O1 failed with **result_code 740, verdict confirmed, family
application_issue, category script_error**: a genuine defect — `timers.setTimeout`
(app.js:36, 250) detaches `setTimeout` from `window`, which throws
`TypeError: Illegal invocation` in a real browser, so Pay sticks on Processing
and no confirmation/order/stock is ever created. Reproduced in headless Chrome
outside Kane. The seeded double-charge is unreachable until this is fixed.
Fix is the loop's next step (NOT done in this task). Full detail in the run log.

## MEASURED — Sun 15 Nov 2026, ~15:35–15:55 (O1 re-run + O2 sweep; restyled deploy, timer fix live)

Target: https://kane-loop-loopmart.vercel.app/index.html (new production
deployment, bold-retail restyle; app.js `bind(globalThis)` fix live, verified
in the served file). Setup: VM replacement mid-task wiped /tmp and the CLI —
kane-cli 0.10.4 reinstalled, OAuth token survived in ~/.testmuai (whoami =
Authenticated, ollymcbride4, no relay needed this time); forwarder
(/tmp/egress-forwarder.py) + Chrome launcher (/tmp/start-kane-chrome.sh) +
objective files recreated from the run log; forwarder on 3129 + Chrome CDP on
9222 re-verified before the runs.

| Item | Measured credits (run_end) | Balance before → after |
|---|---|---|
| **Interrupted O1 re-run** — killed by a VM replacement at step 3 (~15:36:30), no run_end, no result | — (no run_end) | 10,030.60 → 10,021.88 (**8.72 burned, nothing to show**) |
| **O1 re-run (fresh author, restyled deploy)** — 23 steps, 175.1 s, status **passed**, result_code 100 | **56.59** | 10,021.88 → 9,955.71 (**66.17 delta**) |
| **O2 chaos sweep (fresh author)** — 23 steps, 223.4 s, status **failed**, result_code **740**, verdict confirmed (see below) | **75.71** | 9,955.71 → 9,876.33 (**79.38 delta**) |
| **Balance now** | — | **9,876.33** |
| **Total spent today (balance deltas)** | — | **323.67** (169.40 earlier + 154.27 this session) |

Balance deltas still run ~4–10 above run_end credits (O1: 56.59 vs 66.17;
O2: 75.71 vs 79.38). Same pattern as before; run_end is the per-run figure,
balance is the ground truth. The O1 gap is again the largest (~9.6) and
probably includes late settlement of the killed run. Do not invent a
reconciliation.

### What O1 re-run + O2 actually found

- **O1 PASSED.** The timer fix works: Pay completes, confirmation shows Total
  paid £45.00 and an order number, exactly one order in the ledger, stock −1
  each. Note: O1 clicks Pay once, so this pass does NOT prove the seeded
  double-charge is gone — it only proves the checkout works.
- **O2 FAILED on the seeded bug — result_code 740, verdict confirmed, confidence
  0.99.** Steps 1–22 passed; step 23 (ledger exactly one order, notebook stock
  −2) failed. Verdict: "Double-clicking Pay creates duplicate checkout orders"
  — 2 charges for one checkout (LOOP-1001, LOOP-1002), 2 orders totalling
  £36.00, Kane Notebook stock 6 (i.e. −4 instead of −2). Root cause per the
  verdict: missing duplicate-payment protection; suggestion: block additional
  Pay submissions as soon as checkout begins and make checkout accept only one
  order. This is the loop's core evidence — the seeded bug, caught live by the
  independent sweep. Saved test: loopmart-chaos-sweep_test.md (authored by
  this run). Evidence: evidence/o2-2026-11-15.ndjson; O1 re-run:
  evidence/o1-rerun-2026-11-15.ndjson; the VM-killed partial run:
  evidence/o1-rerun-interrupted-2026-11-15.ndjson.
- **Budget still healthy:** 9,876.33 − 250 reserve ≈ 9,626 usable ≈ ~150–170
  iterations at the measured ~57–76/run. O2 (75.71) costs more than O1 (56.59)
  — longer run (223 s) with more steps/analysis. No scope change needed.
  Next spend: fixer + green replay + sweep per fix (~180/run if all three run).

## Green re-run (double-charge fix) — 15 Nov 2026, ~16:05–16:14 GMT

- **Balance:** 9,876.33 → **9,726.21**. Session spend (balance delta) **150.12**; run_end credits sum 121.36. Gap ~28.8 — same pattern as before (deltas run above run_end); no invented reconciliation.
- **O1 replay (testmd run, saved loopmart-o1-core-5_test.md): FAILED twice on a Kane replay-analyzer bug, NOT the app** — `analyzer_failed @ step 2`, verdict broken/automation_bug, confirmed false, 2.39 + 2.15 credits, ~20 s each. The page loaded fine (catalogue, prices, empty cart); the replay analyzer stalled after reading the product price. Evidence: evidence/o1-green-replay-2026-11-15.ndjson (second attempt overwrote the first — same failure, same step).
- **O1 fresh author (verbatim objective, --name loopmart-o1-core): PASSED** — 179.3 s, **53.69 credits**, result_code 100, exit 0. Confirmation £45.00, 1 order, stock −1 each. Saved test: loopmart-o1-core-6_test.md (authored by this run). Evidence: evidence/o1-green-2026-11-15.ndjson.
- **O2 sweep, first attempt: FAILED on an agent misstep, NOT the app** — result_code 750, verdict automation_bug/agent_misstep, confirmed false, confidence 0.98, 72.2 s, **13.39 credits**. The agent did not save the product prices as a variable before proceeding, so it could not do the self-derived totals. Evidence: evidence/o2-green-2026-11-15.ndjson was overwritten by the retry (see below) — the failed attempt's NDJSON is NOT preserved; only its run_end fields are recorded here and in the run log.
- **O2 sweep, retry: PASSED** — 180.5 s, **49.73 credits**, result_code 100, exit 0. Double-click Pay → exactly 1 order, Notebook stock −2, other stock unchanged. Evidence: evidence/o2-green-2026-11-15.ndjson (retry).
- **Budget still healthy:** 9,726.21 − 250 reserve ≈ 9,476 usable ≈ ~150–170 iterations at ~50–76/run. No cost pressure.

## O1 replay, 3rd attempt — 15 Nov 2026, ~16:16 GMT

- **Balance:** 9,726.21 → **9,723.47**. Spend **2.74** (balance delta 2.7393 = run credits 2.73935 exactly — no gap this time).
- **O1 replay (testmd run, saved loopmart-o1-core-6_test.md — the most recent passing O1 test, chosen over -5 which failed twice identically): FAILED a third time on a Kane replay-analyzer bug, NOT the app** — `analyzer_failed @ step 18`, 23 s, exit 1, **2.74 credits**, no result_code. Verdict: confirmed false, bug_title "Total-value capture fails despite correct cart total", family automation_bug, category config_issue, severity minor, confidence 0.93. This attempt got further than the first two (18 actions executed; variables show subtotal £15, £50, discount −£5 stored) and failed while analyzing/capturing the total even though the cart correctly displayed £45.00. The app was correct; the replay analyzer could not capture the total value. Session: 81133c1f-fedf-4b7b-963d-b563ab6579c2. No share test_url was emitted in the NDJSON. Evidence: evidence/o1-green-replay-3rd-2026-11-15.ndjson (+ .stderr).
- **Final LOOP_VERIFIED status: substance-only, NOT literal.** Three replay attempts, three Kane-side analyzer failures (steps 2, 2, 18), all confirmed false, ~2–3 credits each. The literal replay leg (prep/03: GREEN = replay_pass AND independent_pass) never passed. The substance is proven: O1's exact objective passes on the fixed deploy (fresh author, result_code 100) and O2's independent sweep passes with the double-click yielding exactly one order (result_code 100). No fourth replay was attempted, per the task.
- **Budget still healthy:** 9,723.47 − 250 reserve ≈ 9,473 usable ≈ ~150–170 iterations at ~50–76/run. No cost pressure.

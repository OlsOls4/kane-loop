# Kane Loop — Credit Budget (Day 1, 12 Nov 2026)

**Status:** THRESHOLDS DEFINED, MEASUREMENTS PENDING. `kane-cli balance` cannot run until Olly signs in to TestMu (`kane-cli whoami` = not logged in, token missing). No credits have been spent. Do not assume 1,000 (dashboard, 9 Nov) or 10,000 (advertised).

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

# Video Tier B drop-ins — LIVE RUN LANDED 15 Nov 2026 (partially live)

**Status:** DRAFT — swap these into the fallback cut's slots at the SAME timings.
A real Kane run exists (sign-in + credits resolved, real `run_end` JSON on disk,
real Test Manager `test_url`). **Partially live:** the bug-proved, evidence, and
fixed-build slots are live. The green slot is SUBSTANCE-ONLY — the fresh O1 pass
+ independent O2 sweep are real, but the literal replay leg is unproven (Kane's
replay analyzer failed 3×, confirmed false). Never show a "replay passed"
run_end: none exists.

## Drop-ins (same slots, same timings)

| Slot | Fallback (now) | Tier B (live run only) |
|---|---|---|
| 0:36–1:12 — Bug proved | Local reproduction, labelled "Seeded bug — disclosed. Reproduced locally." | **LIVE — Real FAIL run_end** (O2 red, `status: failed`, exit 1, `result_code` 740, verdict confirmed 0.99) + **real Kane screenshot** of the checkout, circled. Narration may now say: "Kane ran the checkout. The ledger check failed — the same order was charged twice." |
| 1:12–1:45 — Evidence | `npm test` real output + labelled FIXTURE run_end | Keep `npm test` (97 passing); replace the fixture shot with the **real run_end JSON** (O2 red, `result_code` 740 — no FIXTURE label, it is a live result now). |
| 1:45–2:11 — Fixed build | Mode toggle, labelled as a demo switch | **Real FIX patch diff** (the actual fix: 28 lines, 2 files — single-flight + idempotency) + the real replay command on screen. Narration may now say: "No human in between. The loop applies its own bounded patch for the bug class — one patch, no test edits." |
| 2:11–2:40 — Green | Pending / live-run diagram, "Kane credits: 0 — no live run yet" | **SUBSTANCE-ONLY — Real GREEN fresh O1 pass AND independent O2 sweep as two distinct visuals** — the fresh O1 `run_end` (`status: passed`, exit 0, `result_code` 100) and the sweep `run_end` (different run id, different inputs), shown side by side, never merged into one shot. There is NO green replay run_end — Kane's replay analyzer failed 3× (confirmed false); say green in substance, never replay-verified. Narration: "Same test, same checkout. Green — and Kane checked it a second, independent way." The pending diagram and the "0 credits" label are CUT in Tier B. |
| 2:40–2:53 — End card | Live URL placeholder | Real deployed URL (https://kane-loop-loopmart.vercel.app/) + repo + one run command. (Repo push still pending — do not claim the code is pushed until it lands.) |

## Lines that are Tier B ONLY (forbidden in the fallback cut)

- "Kane ran the checkout"
- "No human in between"

## What does NOT change in Tier B

- Never a step number ("the ledger check failed" only).
- The seeded bug stays disclosed as seeded.
- The G1 genuine defect stays disclosed if shown.
- Manual captions checked word-for-word; YouTube Unlisted; tested incognito at 1366×768.
- Hard stop 3:00 — if the live footage runs long, cut the install segment, never the green.

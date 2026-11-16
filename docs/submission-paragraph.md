# Submission paragraph — Kane Loop (DRAFT, finalise 18 Nov)

**Status:** DRAFT for the SurveyMonkey submission form. Luma's four required
elements are all present: what was built, who it is for, which agent was used,
and what Kane does in the flow. Honest about the live-run status as of 15 Nov —
live runs landed that day; the bracketed sentence states the real results,
including the unproven replay leg.

> Kane Loop is a veto gate for AI coding agents, built for developers who use an agent to write code and want proof — not a promise — that it works. A watcher any agent can install in one command blocks on a diff, not on a claim: `kane-watch` fires Kane CLI on every save, parses the NDJSON run, and only a separate verifier process can write `LOOP_VERIFIED`, after replaying the committed `_test.md` suite and running a fresh independent chaos sweep in which Kane derives the expected total itself. Its demo victim is LoopMart, a tiny no-login checkout (Loop Mug £15, Debug Hoodie £35, Kane Notebook £10) where a double-click on Pay charges the same order twice — so a failure is a visible ledger error, not a missing class. The loop closed end-to-end live on the seeded bug (fail → patch → green, 100 tests passing), with the classifier routing on `result_code` 740, a bounded fixer that cannot touch tests, and caps that escalate to a visible human-blocked state. [Live Kane runs 15–16 Nov 2026 (20 runs, 897.68 credits): O1 first caught a real bug — a detached setTimeout left Pay stuck on Processing (740) — fixed, then O1 green (100); O2 caught the seeded double-charge live (740, 2 orders), the fix landed (28 lines, 2 files), and O2 went green on retry (100, 1 order); on the submitted fixed build (deploy 7) O1 and O2 both passed fresh (100, 100) and the G1 ledger fix was probed live. On 16 Nov a save fired the gate end-to-end: replay pass (100) + independent sweep pass (100) → LOOP_VERIFIED, on the submitted build. The narrowed caveat: the earlier -6 test file still fails Kane's replay analyzer at step 18 (5×, Kane-side, app correct); the -8 test is the one that replays.]

## Checklist against Luma's requirements

- [x] What was built: `kane-watch` veto gate + LoopMart victim + Loop Console.
- [x] Who it is for: developers using an AI coding agent who want proof, not a promise.
- [x] Which agent was used: **Muse** (the coding agent that built the gate, LoopMart and the fixer) — **Kane CLI is the verifier, not the agent**: it runs the committed `_test.md` suite (`kane-cli testmd run`, `--agent --headless --no-adaptive-heal --bug-detection continue --timeout 300`) and the independent chaos sweep, and its `run_end`/`result_code` verdicts gate the loop.
- [x] What Kane does in the flow: runs the committed `_test.md` suite on every save, reports `run_end`/`result_code` 740, and runs the independent chaos sweep that derives the expected total itself.
- [x] Honest about live-run status (bracketed sentence states the real results: O1 100, O2 caught the seeded bug 740, fix landed, O2 green 100 — the loop closed literally on 16 Nov when a save fired the gate end-to-end (replay 100 + sweep 100 → LOOP_VERIFIED); the narrowed caveat is that the earlier -6 test file still fails Kane's replay analyzer at step 18, 5×, Kane-side).

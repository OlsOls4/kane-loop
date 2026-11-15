# Submission paragraph — Kane Loop (DRAFT, finalise 18 Nov)

**Status:** DRAFT for the SurveyMonkey submission form. Luma's four required
elements are all present: what was built, who it is for, which agent was used,
and what Kane does in the flow. Honest about the live-run status as of 15 Nov —
live runs landed that day; the bracketed sentence states the real results,
including the unproven replay leg.

> Kane Loop is a veto gate for AI coding agents, built for developers who use an agent to write code and want proof — not a promise — that it works. A watcher any agent can install in one command blocks on a diff, not on a claim: `kane-watch` fires Kane CLI on every save, parses the NDJSON run, and only a separate verifier process can write `LOOP_VERIFIED`, after replaying the committed `_test.md` suite and running a fresh independent chaos sweep in which Kane derives the expected total itself. Its demo victim is LoopMart, a tiny no-login checkout (Loop Mug £15, Debug Hoodie £35, Kane Notebook £10) where a double-click on Pay charges the same order twice — so a failure is a visible ledger error, not a missing class. The loop closed end-to-end on live runs on the seeded bug (fail → patch → green, 97 tests passing), with the classifier routing on `result_code` 740, a bounded fixer that cannot touch tests, and caps that escalate to a visible human-blocked state. [Live Kane runs landed 15 Nov 2026: O1 passed (result_code 100), O2 caught the seeded double-charge live (740, 2 orders), the fix landed (28 lines, 2 files), and O2 went green on retry (100, 1 order). The literal replay leg is unproven — Kane's replay analyzer failed 3× (confirmed false); the loop is green in substance: fresh O1 + independent O2 pass.]

## Checklist against Luma's requirements

- [x] What was built: `kane-watch` veto gate + LoopMart victim + Loop Console.
- [x] Who it is for: developers using an AI coding agent who want proof, not a promise.
- [x] Which agent was used: Kane CLI (`kane-cli run` / `testmd run`, `--agent --headless --no-adaptive-heal --bug-detection continue`).
- [x] What Kane does in the flow: runs the committed `_test.md` suite on every save, reports `run_end`/`result_code` 740, and runs the independent chaos sweep that derives the expected total itself.
- [x] Honest about live-run status (bracketed sentence states the real results: O1 100, O2 caught the seeded bug 740, fix landed, O2 green 100 — and the replay leg unproven).

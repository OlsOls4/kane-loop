# Kane Loop — a veto gate for AI coding agents

> **A watcher any agent can install in one command, that blocks on a diff, not on a claim.** The coding agent's "done" is provisional; only a separate verifier process can mark a change verified — after replaying the committed `_test.md` suite **and** an independent chaos/defect sweep in which Kane derives the expected total itself.

Built for the **TestMu Kane CLI Online Hackathon** (12–19 Nov 2026, $3,000 in prizes).
Submission deadline: **19 Nov 2026, 23:59 IST (18:29 GMT)** — confirmed on the Luma page and by organiser email, 12 Nov 2026.

## What it is

`kane-watch` — a file watcher / save hook that fires Kane CLI, parses the NDJSON run, classifies the result, and (only for a genuine app bug, confirmed twice) hands a minimal fix prompt to the coding agent. The agent cannot self-certify.

- **Veto gate, not a watcher:** the agent's `PROVISIONAL_DONE` means nothing until the verifier writes `LOOP_VERIFIED` (replay pass **and** independent sweep pass).
- **Caps:** 3 attempts per failure signature **and** 5 attempts per claim, then a visible `HUMAN_BLOCKED` state. No 4th run.
- **Anti-cheat:** a fix that deletes an assertion, hard-codes a value, or edits a test is rejected and rolled back.
- **Verdict over exit code:** the classifier trusts `run_end.status` / `result_code` / `verdict` over the process exit code. A confirmed product bug arrives as `result_code` 740.
- **Credit budgeting:** thresholds are computed from the *measured* Day 1 balance, not from the advertised 10,000. See `docs/credit-budget.md`.
- **Confirm-before-fix:** a first red triggers a zero-credit replay before any code change. Only a second identical red dispatches the fixer.

Unlike the official Kane skill, which runs a flow once and reports, Kane Loop adds diff-scoped objectives, a committed `_test.md` suite replayed instead of re-authored, credit budgeting against the measured account balance, 3-attempt escalation (plus a per-claim cap of 5) to a visible human-blocked state, an independent chaos sweep in which Kane derives the expected total itself, and anti-cheat — with verdict-based gating on `result_code` 740. GuardianKane (August 2nd place) is prior art: it is a Claude Code Stop-hook gate; Kane Loop is an agent-agnostic watcher that gates on the git diff, and LoopMart is a disposable victim, not the product.

## The demo victim: LoopMart

A tiny single-page checkout — 3 products, cart, discount, fake pay, order confirmation, visible order ledger. 4 clicks, no auth, no login, deterministic.

| Product | Price |
|---|---|
| Loop Mug | £15.00 |
| Debug Hoodie | £35.00 |
| Kane Notebook | £10.00 |

Core flow: Mug + Hoodie = £50.00 subtotal, discount code **KANE10** (10% off) = −£5.00, total **£45.00**. Pay → confirmation shows `Total paid £45.00`, order `LOOP-1001`, exactly one ledger order, stock decremented by exactly 1 each.

**Seeded bug (disclosed as seeded):** double-charge on double-click Pay / retry — the same order is charged twice, the ledger shows two orders, stock decrements twice, a second confirmation is issued. The cart total stays correct (£45.00): the checkout *looks* done while the money is wrong underneath. Full spec: `docs/loopmart-spec.md`.

## 30-second judge path

1. Open the live URL: checkout loads, three products visible, cart empty.
2. Click `Demo: add Mug + Hoodie`, apply KANE10, click Pay: confirmation `Total paid £45.00`, order `LOOP-1001`, ledger exactly one order, stock Mug 9 / Hoodie 9.
3. Click `Break it`: the Loop Console strip goes to FAIL (exit 1), the latest-run card shows the failing step, Kane's screenshot, and the fix — no scrolling or clicking.
4. After the loop fixes it: same flow, `Total paid £45.00`, exactly one ledger order, stock −1 each.
5. Replay the suite from the README in <30s (`testmd run` of the committed `_test.md` files) and see fail-then-green without running the video.

## Status — Day 1 (12 Nov 2026)

- [x] Kane CLI pinned: **0.10.4** (`npm view` + `kane-cli --version`, 12 Nov). 0.10.3 was the 9 Nov latest; 0.10.4 supersedes it.
- [x] Flags verified on 0.10.4: `--agent` (run + testmd run), `--no-adaptive-heal` (testmd run only), `--bug-detection off|stop|continue` (run + testmd run), `--analyzer-only` / `--condition`.
- [x] NDJSON parser fixture tests pass (7/7 — see `kane-watch/test/`).
- [x] LoopMart spec + Kane objectives frozen (`docs/`).
- [ ] **TestMu sign-in — BLOCKED, needs Olly.** `kane-cli whoami` reports "Not logged in", token missing. Sign-in is `kane-cli login --oauth` (browser) or `--username/--access-key`; the TestMu account is password sign-in (username `ollymcbride4`, Google sign-in does not work there). No first authenticated run and no credit measurement until this is done.
- [ ] Credit budget — written as relative thresholds (`docs/credit-budget.md`); unit costs pending the first authenticated run.
- [ ] LoopMart app + `kane-watch` loop — build 13–14 Nov.

## Install & run

```sh
npm install -g @testmuai/kane-cli@0.10.4
kane-cli whoami        # must show signed in
kane-cli balance       # record the number; do not assume 10,000
kane-cli config show
npm run demo           # serves LoopMart locally + shows the recorded loop
```

Preflight fails fast with a human-readable fix when sign-in, balance, or config is missing. Loop runs target the local preview server rebuilt per attempt; final verification and judge replay target the canonical deployed URL.

## How the loop works

See `docs/loop-design.md` (classifier, fix contract, caps, green-twice = replay **and** independent pass, confirm-before-fix, journal schema) and `docs/kane-objectives.md` (objectives O1–O5 verbatim).

## Evidence

`evidence/` holds curated red + green `run_end` JSON, key screenshots, and Test Manager `test_url` links. Raw NDJSON stays gitignored under `.testmuai/`. The run journal (`journal.jsonl`) is append-only; `state.json` is derived from it, never the source of truth.

## Repo map

```
docs/            frozen spec + objectives + design + console/video + risks (Day 1)
kane-watch/      the veto-gate watcher (src/ + test fixtures)
app/             LoopMart checkout (from 13 Nov)
tests/           committed _test.md suite (authored once with `kane run --name`)
evidence/        curated red/green evidence packs
journal.jsonl    append-only run journal
```

## Known limits

- No PRD tracker, no secret scan, no file locking (those are GuardianKane's). No `kane-cli explore` (Max plan only).
- Kane flakiness is handled by confirm-before-fix replay, never by editing a test to match a bug.
- Video (≤3 min, Olly-voiced, manual captions) and submission (SurveyMonkey, ~10:00 GMT 19 Nov) are human-gated steps — see `docs/risks-and-checks.md`.

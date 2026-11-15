# Video script — Kane Loop (honest fallback cut)

**Status:** DRAFT — Olly voices it himself (do NOT generate audio/video).
**Timing:** 375 words at ~130 wpm ≈ 2:53 + 5s buffer = 2:58, hard stop 3:00.
**Word count:** 375 (counted on the narration paragraphs, time-slot headers excluded — recount after any edit; the earlier 374 was counted on a pre-edit version).
**Rules (videographer):** narrate "the ledger check failed", NEVER a step number
(the fixture's failing step is step 6, not step 4). The Tier B lines ("Kane ran
the checkout", "No human in between") are live ONLY in the slots the drop-ins
mark live — the green slot is substance-only (fresh O1 + independent O2 pass;
replay unproven). Fixture numbers are never shown as real; any fixture on screen carries an on-screen
"FIXTURE — synthetic, not a live run" label. LoopMart ledger text is 14px and
below the fold at 1366×768 — the hook uses a zoomed crop on the ledger, not a
full-page capture.

## Narration (verbatim — 374 words)

**0:00–0:21 — Hook (zoomed ledger crop, double-click Pay → 2 orders)**

My coding agent just shipped this checkout. It looks done. It isn't — and nobody checked. Watch: I click Pay twice. One checkout. Two orders in the ledger. Stock down by two. The total on screen still says forty-five pounds — correct. The money underneath is wrong.

**0:21–0:36 — Install (real terminal, one command)**

Kane Loop is a watcher that blocks on a diff, not on a claim. One command installs it. One save starts the gate. No dashboard, no 'trust me, it works.'

**0:36–1:12 — Bug proved locally (labelled "Seeded bug — disclosed. Reproduced locally.")**

This is LoopMart — three products, one discount code, one seeded bug, disclosed up front. The bug is a double charge on a double-click. Here it is, reproduced locally: two orders, one checkout. The ledger check failed. Nothing here is a live Kane run yet — that label stays on screen the whole time. The console shows it all — the strip, the latest run, the fix — and every row says live, local, or fixture, in words, not in colour.

**1:12–1:45 — Real output (`npm test` + labelled FIXTURE run_end)**

The loop itself runs on real output. Ninety-seven tests pass — parser, classifier, the checkout, the fixer, the sweep. And this is the fixture the classifier reads: a synthetic run_end, labelled fixture, never a live result. Result code seven-four-zero — the classifier's verdict, not a claim from the app. The gate needs two greens before it calls anything verified: the same test replayed, and a fresh sweep that works the total out itself.

**1:45–2:11 — Fixed build (mode toggle, labelled honestly — NOT an autonomous fix)**

The fix is one patch, twenty-eight lines across two files — a single-flight guard and an idempotency guard. Toggle the mode and the same double-click charges once. That toggle is a demo switch, not an autonomous fix: the real loop applies its own bounded patch and replays the test. What you are seeing is the fixed build.

**2:11–2:40 — Live runs (real run_ends on screen, ≥5s each)**

So what happened? Kane ran the checkout live. The core flow passed; then the chaos sweep caught the seeded double-charge — two orders, one checkout, result code seven-four-zero. The fix landed, twenty-eight lines, and the sweep went green on retry: one order, result code one hundred. Replay unproven — Kane's analyzer failed three times, not the app.

**2:40–2:53 — End card (live URL + repo + one run command, readable ≥5s)**

Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim. Try it — one link, one command. Break it yourself.

## On-screen labels (must appear, exact wording)

- Hook: `Seeded bug — disclosed. Reproduced locally.`
- Fixture run_end: `FIXTURE — synthetic, not a live run` (on screen for the whole fixture shot)
- Live-run diagram: `O2 green — result_code 100 · 1 order · stock −2` (≥5s)
- Fixed build: `Fixed build — mode toggle (demo switch, not an autonomous fix)`

## Filming notes

- Hook: zoomed crop on the ledger only (14px text, below the fold at 1366×768 — never a full-page capture).
- Terminal: ≥18pt; key numbers (totals, exit codes, credits) ≥24px.
- Install segment: film the REAL command — `npm install -g github:OlsOls4/kane-loop` then `kane-watch --dry-run` (verified working 15 Nov). Do NOT film `npm install -g @testmuai/kane-cli` as the kane-watch install.
- `npm test` segment: film the real output (97 tests passing); do not stage it.
- Manual captions, checked word-for-word against this script. YouTube Unlisted (not Private). Tested incognito at 1366×768 before submit.

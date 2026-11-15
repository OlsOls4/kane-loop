# Video script — Kane Loop (fix pass, FINAL)

**Status:** FINAL — Muse TTS, Paloma (Lilting Swing, avocado_v2:paloma) at natural speed 100 — never slowed. Olly approved Muse doing the video + TTS 15 Nov 21:06.
**Timing:** 407 words, measured 154.520s (2:34.5). Hard stop 3:00.
**Word count:** 407 (counted on the narration paragraphs below; recount after any edit).
**Rules:** neutral presenter voice, NEVER first-person ("I built this" is out; "No human in between" is out). Narrate "the ledger check failed", NEVER a step number. The seeded bug stays disclosed as seeded. The green slot is substance-only (fresh O1 + independent O2 pass; replay unproven — Kane's analyzer failed 4×, never "replay passed"). All numbers are real: 100 tests, 16 live runs, 820.68 credits spent, balance 9,379.32. LoopMart ledger text is 14px and below the fold at 1366×768 — the hook uses a zoomed crop on the ledger, not a full-page capture.

## Chronology (the story, in order)

O1 first live run caught a REAL bug (detached setTimeout, Pay stuck on Processing, result_code 740) → timer fix → O1 green → O2 chaos sweep caught the SEEDED double-charge (740) → fix (28 lines, 2 files) → O2 green on retry. The hook teases the seeded double-charge first; seg3 then tells the story in order.

## Narration (verbatim — 407 words)

**0:00–0:21 — Hook (zoomed ledger crop, double-click Pay → 2 orders)**

This checkout looks done. It isn't — and nobody checked. Watch: Pay is clicked twice. One checkout. Two orders in the ledger. Each stock down by two. The total on screen still says forty-five pounds — correct. The money underneath is wrong.

**0:21–0:36 — Install (real terminal, one command)**

Kane Loop is a watcher that blocks on a diff, not on a claim. One command installs it. One save starts the gate. It watches the repo: a save runs the gate, Kane checks the checkout, and a red verdict blocks the ship until the fix is verified. No dashboard, no 'trust me, it works.'

**0:36–1:12 — Bug (seeded bug disclosed + O1's REAL timer bug, live run_end on screen)**

That double charge is the seeded bug — disclosed up front. LoopMart is a checkout with three products, one discount code, and one bug planted on purpose. But the first live run caught a real one first: Pay stuck on Processing, a timer detached from the window, so the payment never fired. The checkout was completely broken in a real browser — and the unit tests had missed it. Result code seven-four-zero. One fix later, the core flow went green.

**1:12–1:45 — Output (real `npm test` 100/100 + real O2-red run_end, live)**

The loop itself runs on real output. One hundred tests pass — parser, classifier, the checkout, the fixer, the sweep. Sixteen live runs, eight hundred twenty credits spent — every number on screen is a real result. Then Kane ran the checkout live, and the ledger check failed: the same order charged twice. Result code seven-four-zero — the classifier's verdict, not a claim from the app. The gate needs two greens before it calls anything verified: the same test replayed, and a fresh sweep that works the total out itself.

**1:45–2:11 — Fixed build (real patch diff + fixed build footage, mode toggle labelled honestly)**

The fix is one patch, twenty-eight lines across two files — a single-flight guard and an idempotency guard. The loop applies its own bounded patch for the bug class: one patch, no test edits. Toggle the mode and the same double-click charges once. What you are seeing is the fixed build.

**2:11–2:40 — Live runs (real green run_ends on screen, O1 + O2 side by side, ≥5s each)**

So what happened? Kane ran the checkout live. The core flow passed, and the chaos sweep went green on retry: one order, result code one hundred. Same test, same checkout — and Kane checked it a second, independent way. One hundred tests, sixteen live runs, two independent green verdicts. And the ledger now survives a new order — verified live. Replay unproven — Kane's analyzer failed four times, not the app.

**2:40–2:53 — End card (live URL + repo + one run command + final numbers, readable ≥5s)**

Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim. Try it — one link, one command. Break it yourself.

## On-screen labels (must appear, exact wording)

- Hook: `Seeded bug — disclosed. Reproduced locally.`
- O1 first run run_end: `LIVE RUN — O1 first run, 15 Nov 2026` (frame's own label) + lower-third `O1 first caught a real bug — Pay stuck on Processing (740), fixed, then green`
- O2 red run_end: `LIVE RUN — O2 chaos sweep, 15 Nov 2026` (frame's own label)
- Fixed build: `Fixed build — mode toggle (demo switch, not an autonomous fix)`
- O1 green run_end: `LIVE RUN — O1 core flow, fresh author, deploy 7, 15 Nov 2026` (frame's own label) + lower-third `O1 green — result_code 100 · fresh author run`
- O2 green run_end: `LIVE RUN — O2 chaos sweep, retry, deploy 7, 15 Nov 2026` (frame's own label) + lower-third `O2 green — result_code 100 · 1 order · stock −2`
- Replay beat: lower-third `Replay leg unproven — Kane's replay analyzer failed 4×`
- No FIXTURE label anywhere — the fixture frame is cut; every run_end shown is a live result.

## Filming notes

- Hook: zoomed crop on the ledger only (14px text, below the fold at 1366×768 — never a full-page capture). 2s cart hold before the double-click.
- Terminal: ≥18pt; key numbers (totals, exit codes, credits) ≥24px.
- Install segment: film the REAL command — `npm install -g github:OlsOls4/kane-loop` then `kane-watch --dry-run` (verified live against pushed head d5adbf6c, 15 Nov). Do NOT film `npm install -g @testmuai/kane-cli` as the kane-watch install.
- `npm test` segment: film the real output (100 tests passing); do not stage it.
- Fix segment: the real patch diff (frozen buggy fixture vs shipped files, 28 lines, 2 files), not a mockup.
- Manual captions, checked word-for-word against this script. YouTube Unlisted (not Private). Tested incognito at 1366×768 before submit.

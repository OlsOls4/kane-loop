# Video script — Kane Loop (B6 stage 1, 17 Nov 2026)

**Status:** FINAL v3 — rebuilt 17 Nov 2026 ~08:53 (B6 stage 2). Muse TTS, Paloma (Lilting Swing, avocado_v2:paloma) at natural speed 100 — never slowed. Olly approved Muse doing the video + TTS 15 Nov 21:06; he approved the new narration audio 17 Nov 08:38 ("Narration sounds good"). **Do NOT upload yet** — the rebuilt v3 goes back to Olly for approval first (standing rule), then upload Unlisted as a NEW video (v2 stays live at https://youtu.be/w1PQDDpR3hg until replaced).
**Timing:** 432 words, **verified 174.200s (2:54.20) by ffprobe** — draft 174.197s; the 0.032s over the 174.168s projection is one frame of concat rounding. Hard stop 3:00 (180s); B6 criterion ≤2:55 (175s) — clears by 0.8s. Audio is the approved v3 takes only (seg4-output-v3.mp3 35.040s, seg6-live-v3.mp3 37.368s, seg7-end-v3.mp3 11.760s); never re-rendered.
**Word count:** 432 (was 407; +20 seg 6, +5 seg 7, seg 4 same count).
**Rules:** neutral presenter voice, NEVER first-person ("I built this" is out; "No human in between" is out). Narrate "the ledger check failed", NEVER a step number. The seeded bug stays disclosed as seeded. The green slot is now the LITERAL close: 16 Nov save fired the gate end to end — replay pass (100, -8 test) + independent sweep pass (100) → LOOP_VERIFIED — with the narrowed caveat (the earlier -6 file still trips Kane's replay analyzer at step 18, 5×, Kane-side; the -8 file is byte-identical, md5 3b456b1e43b9bde825fc742a7f8c3392). All numbers are real: 100 tests, 20 live runs, 897.68 credits spent, balance 9,302.32. LoopMart ledger text is 14px and below the fold at 1366×768 — the hook uses a zoomed crop on the ledger, not a full-page capture.

## B6 changes (17 Nov 2026 — stage 1; only segs 4/6/7 changed)

- **Seg 4, cue 22** — OLD: "Sixteen live runs, eight hundred twenty credits spent — every number on screen is a real result." NEW: "Twenty live runs, eight hundred ninety-eight credits spent — every number on screen is a real result." (897.68 rounded to the nearest whole credit, as the original did for 820.68; the exact 897.68 stays on screen.)
- **Seg 6, cue 34** — OLD: "One hundred tests, sixteen live runs, two independent green verdicts." NEW: "One hundred tests, twenty live runs, two independent green verdicts."
- **Seg 6, cue 36 (REPLACED)** — OLD: "Replay unproven — Kane's analyzer failed four times, not the app." NEW: "A save fired the gate: replay passed on the minus-eight test, sweep passed — loop verified." (Spoken as "loop verified": the TTS spells out the all-caps token LOOP_VERIFIED letter by letter, ~12s for the four words — measured 17 Nov. The on-screen lower-third still shows LOOP_VERIFIED, and the captions follow the spoken words.)
- **Seg 6, cue 37 (NEW, trimmed for length 17 Nov)** — First draft: "One caveat: the older test file still trips Kane's analyzer — a Kane-side bug, not ours — so the verified run uses an identical rebuilt file." FINAL (recorded): "One caveat: the older test file still trips Kane's analyzer — a Kane-side bug, not ours." The dropped clause ("so the verified run uses an identical rebuilt file") stays visible on the seg-6 caveat lower-third and in the submission paragraph; the trim saves ~2s to keep the video under 2:55.
- **Seg 7, end card** — OLD: "Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim. Try it — one link, one command. Break it yourself." NEW: "Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim. Twenty live runs, loop verified. Try it — one link, one command. Break it yourself." (Spoken as "loop verified" — same TTS spelling issue as seg 6; the end-card visual shows LOOP_VERIFIED. The exact 897.68 credits figure is on the end-card visual and in seg 4 narration.)
- **On-screen labels** — replay lower-third OLD: "Replay leg unproven — Kane's replay analyzer failed 4×". NEW: "LOOP_VERIFIED — 16 Nov 2026 · replay 100 + sweep 100" (bottom) + caveat lower-third (top). The caveat lower-third as built reads "Older -6 file trips Kane's analyzer — verified run uses the identical -8 file" — the plan's "(Kane-side)" clause was dropped from the lower-third only: the full text measured 1414px at 28px, wider than the 1366px frame, and would have been cut off on both sides. The attribution is spoken + captioned in the same beat ("a Kane-side bug, not ours"). End-card numbers line OLD: "100 tests · 16 live runs · 820.68 credits spent". NEW: "100 tests · 20 live runs · 897.68 credits · LOOP_VERIFIED".
- Every other cue is byte-identical to the 15 Nov FINAL script. Segment timings below are the 15 Nov timings; segs 6–7 shift after the rebuild — re-measure by ffprobe in stage 2 (see video/B6-STAGE2-PLAN.md).

## Chronology (the story, in order)

O1 first live run caught a REAL bug (detached setTimeout, Pay stuck on Processing, result_code 740) → timer fix → O1 green → O2 chaos sweep caught the SEEDED double-charge (740) → fix (28 lines, 2 files) → O2 green on retry → 16 Nov save fired the gate end to end (replay 100 + sweep 100 → LOOP_VERIFIED). The hook teases the seeded double-charge first; seg3 then tells the story in order; seg6 closes with the literal LOOP_VERIFIED, not the replay concession.

## Narration (verbatim — 432 words)

**0:00–0:21 — Hook (zoomed ledger crop, double-click Pay → 2 orders)**

This checkout looks done. It isn't — and nobody checked. Watch: Pay is clicked twice. One checkout. Two orders in the ledger. Each stock down by two. The total on screen still says forty-five pounds — correct. The money underneath is wrong.

**0:21–0:36 — Install (real terminal, one command)**

Kane Loop is a watcher that blocks on a diff, not on a claim. One command installs it. One save starts the gate. It watches the repo: a save runs the gate, Kane checks the checkout, and a red verdict blocks the ship until the fix is verified. No dashboard, no 'trust me, it works.'

**0:36–1:12 — Bug (seeded bug disclosed + O1's REAL timer bug, live run_end on screen)**

That double charge is the seeded bug — disclosed up front. LoopMart is a checkout with three products, one discount code, and one bug planted on purpose. But the first live run caught a real one first: Pay stuck on Processing, a timer detached from the window, so the payment never fired. The checkout was completely broken in a real browser — and the unit tests had missed it. Result code seven-four-zero. One fix later, the core flow went green.

**1:12–1:45 — Output (real `npm test` 100/100 + real O2-red run_end, live)**

The loop itself runs on real output. One hundred tests pass — parser, classifier, the checkout, the fixer, the sweep. Twenty live runs, eight hundred ninety-eight credits spent — every number on screen is a real result. Then Kane ran the checkout live, and the ledger check failed: the same order charged twice. Result code seven-four-zero — the classifier's verdict, not a claim from the app. The gate needs two greens before it calls anything verified: the same test replayed, and a fresh sweep that works the total out itself.

**1:45–2:11 — Fixed build (real patch diff + fixed build footage, mode toggle labelled honestly)**

The fix is one patch, twenty-eight lines across two files — a single-flight guard and an idempotency guard. The loop applies its own bounded patch for the bug class: one patch, no test edits. Toggle the mode and the same double-click charges once. What you are seeing is the fixed build.

**2:11–2:40 — Live runs (real green run_ends on screen, O1 + O2 side by side, ≥5s each)**

So what happened? Kane ran the checkout live. The core flow passed, and the chaos sweep went green on retry: one order, result code one hundred. Same test, same checkout — and Kane checked it a second, independent way. One hundred tests, twenty live runs, two independent green verdicts. And the ledger now survives a new order — verified live. A save fired the gate: replay passed on the minus-eight test, sweep passed — loop verified. One caveat: the older test file still trips Kane's analyzer — a Kane-side bug, not ours.

**2:40–2:53 — End card (live URL + repo + one run command + final numbers, readable ≥5s)**

Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim. Twenty live runs, loop verified. Try it — one link, one command. Break it yourself.

## On-screen labels (must appear, exact wording)

- Hook: `Seeded bug — disclosed. Reproduced locally.`
- O1 first run run_end: `LIVE RUN — O1 first run, 15 Nov 2026` (frame's own label) + lower-third `O1 first caught a real bug — Pay stuck on Processing (740), fixed, then green`
- O2 red run_end: `LIVE RUN — O2 chaos sweep, 15 Nov 2026` (frame's own label)
- Fixed build: `Fixed build — mode toggle (demo switch, not an autonomous fix)`
- O1 green run_end: `LIVE RUN — O1 core flow, fresh author, deploy 7, 15 Nov 2026` (frame's own label) + lower-third `O1 green — result_code 100 · fresh author run`
- O2 green run_end: `LIVE RUN — O2 chaos sweep, retry, deploy 7, 15 Nov 2026` (frame's own label) + lower-third `O2 green — result_code 100 · 1 order · stock −2`
- Replay beat: lower-third `LOOP_VERIFIED — 16 Nov 2026 · replay 100 + sweep 100` + caveat lower-third `Older -6 test file trips Kane's analyzer (Kane-side) — verified run uses the identical -8 file` (was: `Replay leg unproven — Kane's replay analyzer failed 4×`)
- End card numbers line: `100 tests · 20 live runs · 897.68 credits · LOOP_VERIFIED` (was: `100 tests · 16 live runs · 820.68 credits spent`)
- No FIXTURE label anywhere — the fixture frame is cut; every run_end shown is a live result.

## Filming notes

- Hook: zoomed crop on the ledger only (14px text, below the fold at 1366×768 — never a full-page capture). 2s cart hold before the double-click.
- Terminal: ≥18pt; key numbers (totals, exit codes, credits) ≥24px.
- Install segment: film the REAL command — `npm install -g github:OlsOls4/kane-loop` then `kane-watch --dry-run` (verified live against pushed head d5adbf6c, 15 Nov). Do NOT film `npm install -g @testmuai/kane-cli` as the kane-watch install.
- `npm test` segment: film the real output (100 tests passing); do not stage it.
- Fix segment: the real patch diff (frozen buggy fixture vs shipped files, 28 lines, 2 files), not a mockup.
- Manual captions, checked word-for-word against this script. YouTube Unlisted (not Private). Tested incognito at 1366×768 before submit.

# Kane Loop demo video — build note (FIX PASS)

**Finished:** 15 Nov 2026, ~22:26 GMT. **Status:** fix pass complete. Ready for Olly to hear the narration before any YouTube upload. **Do NOT upload yet** — narration needs Olly's ear approval first (standing rule), then upload Unlisted.

## Deliverables (in `build/kane-loop/video/`)
- `kane-loop-demo.mp4` — finished video, **154.520s (2:34.5)**, 1366×768, h264 + AAC, 16.7 MB. Captions burned in. Under the 3:00 hard stop with 25s to spare.
- `kane-loop-demo-draft.mp4` — same cut without burned-in captions (17.2 MB).
- `narration.mp3` — full narration alone, **151.488s**, so Olly can hear the voice first.
- `audio/seg1-hook.mp3` … `audio/seg7-end.mp3` — the 7 TTS segments.
- `captions.srt` — 39 cues, verbatim narration (407 words).
- `kane-loop-demo-v1.mp4`, `narration-v1.mp3` — the draft cut's files, kept as backup.
- `build/` — reusable scripts: `capture2.mjs`, `render-frames.py`, `assemble.sh`, `make-srt.py`, `egress-forwarder.py`.

## Narration
- Voice: **Paloma (Lilting Swing, avocado_v2:paloma), natural speed 100** — never slowed, per the standing rule. TTS CLI confirmed `voice: avocado_v2:paloma` on all 7 segments.
- **407 words** (true word count; the caption generator's first count said 419 because it counted standalone em-dash tokens as words — fixed in make-srt.py).
- Segments (ffprobe-measured): hook 18.240s, install 21.168s, bug 25.632s, output 25.968s, fix 21.960s, live 29.088s, end 9.432s. Total speech 151.488s + 6×0.5s gaps = 154.488s; final file 154.520s.
- Source: `docs/video-script.md` (fix pass), verbatim — no words changed.

## What changed vs the draft cut (all Wave 4 corrections applied)
1. **Tier B merged** — no fallback wording anywhere ("Nothing here is a live Kane run yet" / fixture run_end are gone; the fixture frame is cut entirely).
2. **Chronology fixed** — O1 caught a REAL bug first (detached setTimeout, Pay stuck on Processing, 740) → fixed → O1 green → O2 caught the SEEDED double-charge (740) → fixed → O2 green.
3. **Neutral presenter voice** — no first-person "I built this"; "No human in between" kept out.
4. **Hook stock line** → "Each stock down by two".
5. **Header fixed** — script no longer says "Olly voices it" (Muse TTS, Olly approved 15 Nov 21:06).
6. **Replay beat updated** — "Kane's analyzer failed four times" (was three); lower-third "Replay leg unproven — Kane's replay analyzer failed 4×".
7. **Numbers updated** — 100/100 tests, 16 live runs, 820.68 credits spent, balance 9,379.32 (draft: 97/97, 10 runs, 476.53, 9,723.47).
8. **2s cart hold** in the hook (clip-00, was already in assemble.sh).

## Footage — how it was captured (fix pass, 15 Nov ~22:19)
- **Live site, real browser.** Playwright Chromium (`~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`) driven over CDP with capture2.mjs; burst screenshots (~250ms) during Pay interactions; stills with slow zoompan. A CONNECT forwarder was already listening on 127.0.0.1:3129 (left over from earlier live-run work — probe returned the live site's 307, so it was reused, not restarted).
- **Buggy footage is the frozen local pre-fix build** (`kane-watch/test/fixtures/buggy-loopmart/`, served on 8081) — reproduces the double-charge for real (2 orders LOOP-1001/1002, flag "2 charges for one checkout", stock 8/8, £45 Mug+Hoodie). Fixed footage is the LIVE site (deploy 8): Reset → double-click → 1 order LOOP-1001, stock 9/9, £45. Both labelled on screen as seeded bug / fixed build.
- **Console footage is the live deploy-8 console** — GREEN (substance), 16 runs, 820.68 credits, latest O2 sweep green (100). Crops cut from the capture with PIL (verdict strip + LIVE banner; timeline rows with PASS/FAIL badges).
- **Text frames are rendered from real outputs**, not mockups: install (`npm install -g github:OlsOls4/kane-loop`, "added 1 package in 13s", dry-run LOOP_VERIFIED — **verified live against pushed head d5adbf6c, 15 Nov 22:18**), npm test 100/100 exit 0 (real run, 9 categories), real run_ends — O1 first (740, 50.37 cr, verdict confirmed 0.98), O2 red (740, 75.71 cr, confirmed 0.99), O1 deploy-7 green (100, 56.82 cr, LOOP-1001, £45.00), O2 deploy-7 green (100, 85.29 cr, 1 ledger order). Fix frame shows the two guards **verbatim from the shipped loopmart files** (idempotency guard in cart.js, single-flight guard in app.js).
- Structure: 7 segments with 0.5s black/silence gaps. Lower-thirds burned in (bottom): "Seeded bug — disclosed. Reproduced locally." (seg1), "O1 first caught a real bug — Pay stuck on Processing (740), fixed, then green" (seg3), "Fixed build — mode toggle (demo switch, not an autonomous fix)" (seg5), "O1 green — result_code 100 · fresh author run" / "O2 green — result_code 100 · 1 order · stock −2" / "Replay leg unproven — Kane's replay analyzer failed 4×" (seg6). Captions at MarginV=120 so they sit above the lower-thirds.
- End card (seg7) has no "Try it" line; it carries the live URL, repo, install command, and "100 tests · 16 live runs · 820.68 credits spent".

## Numbers used (all verified, nothing invented)
100/100 tests passing · 16 live Kane runs · 820.68 credits spent · balance 9,379.32 · O1 green 56.82 credits · O2 green 85.29 credits · O2-red verdict confirmed 0.99 · O1-first verdict confirmed 0.98.

## Verification done on the finished file
- ffprobe: h264 1366×768 @25fps + AAC, 154.520s, 16.7 MB; draft (no captions) 154.525s.
- Frames checked at t=5, 25, 50, 80, 105, 120, 130, 140, 152: hook ledger (2 orders), install terminal, O1-first run_end, O2-red run_end, fix guards, O1-green run_end, O2-green run_end, console-top with replay lower-third, end card — all legible, all numbers match the evidence.
- **Caption defect found and fixed:** the first burn rendered captions ~2.7× too big and vertically centred (libass defaults PlayResY to 288, scaling FontSize/MarginV) — they covered the install command on the end card. Fixed by adding `PlayResX=1366,PlayResY=768` to the subtitles force_style in assemble.sh, re-burned, and re-verified at 6 timestamps: captions are now 26px, bottom-centred, 120px above the bottom, sitting above the lower-thirds. (The draft cut had the same oversized-caption defect — it was never caught because its end-card check looked at the no-captions file.)

## What could NOT be verified / known issues
1. **Word-for-word audio check:** no local whisper model is installed (faster-whisper not importable, no ~/workspace/models). The TTS CLI took the exact script text via stdin and returned ok for all 7 segments with the Paloma voice ID confirmed; segment durations are proportional to word counts. Olly's ear check is the approval gate before upload.
2. **"28 lines" patch size:** the fixer's documented bounded patch (15 Nov 15:53). It is not a fresh diff — the shipped-vs-frozen-fixture diff mixes the later Wave 4 re-arm and the G1 ledger fix, so the frame shows the guards verbatim instead of a diff.
3. The end-card numbers line matches the console at capture time (22:19). If more Kane runs happen before upload, it goes stale — re-check at upload time.

## Not done (separate steps, per the task)
No YouTube upload, no posting, no submission, no GitHub push.

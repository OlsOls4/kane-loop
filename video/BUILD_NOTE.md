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

## V3 rebuild (B6 stage 2, 17 Nov 2026)

**Finished:** 17 Nov 2026, ~08:53 GMT. **Status:** rebuilt from the approved v3 narration; NOT uploaded — goes back to Olly for approval first. Files: `kane-loop-demo-v3-draft.mp4` (no captions, 20,131,014 B, 174.197s) and `kane-loop-demo-v3.mp4` (captions burned in, 18,415,704 B, 174.200s). The live v2 `kane-loop-demo.mp4` is untouched (15 Nov 22:28, md5 aa7068fd899e68169a965df3e4372807).

**What changed vs v2:** seg 4/6/7 narration (approved v3 takes, Paloma speed 100, never re-rendered); seg 4 clip-02 extended 13.968→23.040s and seg 6 clip-03 extended 10.088→18.368s to sum to the new audio; seg-6 clip-03 re-captured from the LIVE deploy-10 console (baked LOOP_VERIFIED verdict, 20 runs, 897.68 credits); replay lower-third deleted; new lower-thirds "LOOP_VERIFIED — 16 Nov 2026 · replay 100 + sweep 100" (bottom) + caveat (top); end-card numbers line "100 tests · 20 live runs · 897.68 credits · LOOP_VERIFIED"; captions regenerated (41 cues, 432 words; seg 4 starts 66.540s, seg 6 at 124.540s, seg 7 at 162.408s). Footage otherwise unchanged; only still durations changed.

**Deviations from B6-STAGE2-PLAN.md (all reported to the parent):**
1. **SRT cue count is 41, not the plan's 40** — seg 7 also gained a cue ("Twenty live runs, loop verified."), so 8+5+6+6+4+8+4 = 41. The plan's expectation was wrong; the SRT is correct.
2. **Caveat lower-third shortened** — the plan's text ("Older -6 test file trips Kane's analyzer (Kane-side) — verified run uses the identical -8 file") measures 1414px at 28px, wider than the 1366px frame; burned text is "Older -6 file trips Kane's analyzer — verified run uses the identical -8 file" (1150px). The "(Kane-side)" attribution is spoken + captioned in the same beat.
3. **Console-top crop shifted** — first crop (page-y 170) put the verdict strip at frame-y ~95, where the zoompan (max 1.12) would have lifted it under the top caveat box by the end of the clip. Re-cut at page-y 66: the strip sits at frame-y ~200 (→~178 at max zoom), clear of the box; the box instead covers the console hero's Repo/Demo-video link line for the 18s of clip-03. The strip, buttons, credits line, LIVE banner, and both cards stay fully visible.
4. **"GREEN (literal)" is not visible page text** — the plan asked the console frame to show GREEN (literal), but deploy 10's console never renders that string; it lives only in console-data-live.json's `verdict` field. The frame shows the canonical verdict line instead: "✓ LOOP_VERIFIED — 16 Nov 2026: replay 100 + independent sweep 100 · 20 runs · 897.68 credits" (strip + banner + detail card) and "PASSED — result_code 100".
5. **Test-count drift (100 vs 104) — OPEN, needs a decision:** npm test is now 104/104 (B14 added 4 tests at 17 Nov ~08:31, after the v3 narration was recorded). The approved narration says "One hundred tests pass" and the end card says "100 tests", but the npm-test frame shows the real current output ("104/104 passing — exit 0") with category lines summing to 104. The frame was kept honest (real output) rather than faked to 100. Options for the parent: accept the video as-is, update the entry's count to 104 everywhere (paragraph, pack, end card, X post 2 already says 100 — it cannot be edited), or re-record seg 4 sentence 2 (needs a fresh ear-check from Olly).
6. **Forwarder incident during capture:** the first capture2.mjs run failed at section B (egress forwarder died silently, Chrome got ERR_PROXY_CONNECTION_FAILED). A forwarder was already listening again on 127.0.0.1:3129 when the restart was attempted (Address already in use; pid 16373, started 08:43, cause of the original death unknown — possibly a transient egress hiccup). Re-ran capture2.mjs to completion with the live forwarder; all four sections verified (buggy ledger 2 orders, fixed ledger 1 order, £45 totals).

**Verification done on the finished v3 file:**
- ffprobe: h264 1366×768 @25fps + AAC, 174.200s (draft 174.197s); ≤175s B6 criterion and ≤180s hard stop, both clear.
- Frames checked at t=10, 55, 61, 72, 90, 130, 155, 168: hook ledger (2 orders, £90, stock 8/8/10), O1-first 740 run_end (0.98), timeline rows 2–10, npm-test frame (104/104), O2-red 740 run_end (0.99), O1-green 100 run_end (LOOP-1001, £45.00), console-top with both lower-thirds (strip + banner fully visible, caveat box legible, captions above the bottom box), end card (numbers line + install command uncovered by captions). All legible; all numbers match the evidence.
- Captions: 26px, bottom-centred, MarginV=120, PlayResX=1366/PlayResY=768 — same force_style as the 15 Nov fix; no oversized-caption recurrence. Long (3-line) captions transiently cover part of the console card's detail text in clip-03 (same characteristic as v2, which Olly approved); the strip, banner, and "PASSED — result_code 100" are never covered, and that line is fully visible in the O1/O2 green clips.
- Audio: AAC stream present; segment muxing used the exact approved v3 mp3 files (35.040 / 37.368 / 11.760s); no re-render, no narration cut.

**Not done (separate steps, per the task):** No YouTube upload, no posting, no submission, no GitHub push. The v3 files are local only until Olly approves the rebuilt video.

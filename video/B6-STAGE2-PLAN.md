# B6 Stage 2 plan — rebuild + re-upload the video (v3)

**Status:** Stage 1 DONE 17 Nov 2026 (new script + new narration audio for segs 4/6/7). Stage 2 runs ONLY after Olly hears `video/narration-segs-467-new.mp3` and approves it. Do NOT rebuild, re-upload, or push anything before that approval.

## Stage 1 outputs (inputs to stage 2)

- Script: `docs/video-script.md` (B6 stage 1; 432 words; narration paragraphs are final).
- New audio (Paloma, avocado_v2:paloma, speed 100 — all confirmed by the TTS CLI):
  - `video/audio/seg4-output-v3.mp3` — 35.040s (was 25.968s)
  - `video/audio/seg6-live-v3.mp3` — 37.368s (was 29.088s)
  - `video/audio/seg7-end-v3.mp3` — 11.760s (was 9.432s)
  - Review file for Olly's ear: `video/narration-segs-467-new.mp3` — 84.168s (the three new segments concatenated in order)
- Unchanged segments keep their 15 Nov audio sample-identical: seg1 18.240s, seg2 21.168s, seg3 25.632s, seg5 21.960s. Old seg4/seg6 audio files (`seg4-output.mp3`, `seg6-live.mp3`) are preserved in `video/audio/` — do not delete.
- **Projected total: 174.168s (2:54.17)** = 87.000 (unchanged) + 84.168 (new) + 3.000 (6×0.5s gaps). B6 criterion ≤2:55 (175s) — margin is thin (+0.8s). Hard stop 3:00 (180s) — margin +5.8s.

## Two things stage 2 must NOT do

1. **Do not re-render the audio.** TTS pacing varies run to run (identical seg-4 text rendered 35.040s and 36.192s on two takes; identical seg-7 text rendered 11.760s and 15.768s). The 174.168s projection holds only for THESE files. If the assembled video comes out over 175s, trim a still or a gap — never re-render audio.
2. **Do not narrate the token `LOOP_VERIFIED`.** The TTS spells all-caps tokens letter by letter ("L-O-O-P underscore V-E-R-I-F-I-E-D", ~12s for four words — measured 17 Nov). Narration says "loop verified" (lowercase); the on-screen lower-thirds and end card show `LOOP_VERIFIED`. Captions follow the spoken words ("loop verified").

## Visuals to re-render

### Seg 4 — output (new audio 35.040s; was 25.968s)
- Footage is UNCHANGED (npm-test frame + O2-red run_end). Only the still durations change so the clips sum to 35.040s.
- Suggested split (narration sentences 1–2 are the npm-test beat, sentences 3–6 the O2-red beat): clip-01 (f-terminal-npmtest.png) ~12s, clip-02 (f-o2red-runend.png) ~23.04s. Verify against the regenerated SRT cue timings in step 4 and adjust so each frame is on screen while its sentence is spoken.
- Update `assemble.sh` seg4 block: clip durations + `mux ... 35.040`.

### Seg 6 — live (new audio 37.368s; was 29.088s)
- clip-01 (O1 green run_end) and clip-02 (O2 green run_end): footage UNCHANGED, re-time to fit the new audio. Suggested: clip-01 9s, clip-02 10s, clip-03 18.368s (the new cues 36–37 — the literal close + caveat — play over the console crop, which is the visual proof).
- **clip-03 MUST be re-captured**: the old console-top crop is the deploy-8 console (GREEN substance, 16 runs, 820.68). Re-capture from the LIVE console at https://kane-loop-loopmart.vercel.app/console.html with `capture2.mjs` (same method as the 15 Nov fix pass). It must show GREEN (literal), 20 runs, 897.68 credits, latest run the 16 Nov LOOP_VERIFIED sweep.
  - **B8 dependency:** the Wave 5 console-shell bake (deploy 10) changes `console.html`. Capture clip-03 from whichever deploy is live when stage 2 runs, and check the frame reads 20 runs / 897.68 / GREEN (literal). If deploy 10 is live, capture from deploy 10.
- Lower-thirds change in `assemble.sh`:
  - DELETE `replay.txt` ("Replay leg unproven — Kane's replay analyzer failed 4×").
  - ADD `loopverified.txt`: `LOOP_VERIFIED — 16 Nov 2026 · replay 100 + sweep 100` (on clip-03, bottom).
  - ADD `caveat.txt`: `Older -6 test file trips Kane's analyzer (Kane-side) — verified run uses the identical -8 file` (on clip-03, top — it must not collide with the bottom lower-third or the captions at MarginV=120).
- Update `assemble.sh` seg6 block: clip durations + `mux ... 37.368`.

### Seg 7 — end card (new audio 11.760s; was 9.432s)
- Re-render the end-card static with `render-frames.py`: numbers line OLD `100 tests · 16 live runs · 820.68 credits spent` → NEW `100 tests · 20 live runs · 897.68 credits · LOOP_VERIFIED`. Live URL, repo, and install command unchanged. No zoompan change.
- Update `assemble.sh` seg7 block: `still ... 11.760` + `mux ... 11.760`.

### Segs 1/2/3/5 — untouched
- No footage, lower-third, or audio changes. `assemble.sh` blocks for s1/s2/s3/s5 stay as they are.

## SRT regeneration

- Update `video/build/make-srt.py` SEGS for segs 4/6/7 only: new sentences (from `docs/video-script.md`, verbatim) + new measured durations (35.040 / 37.368 / 11.760).
- Recompute segment start offsets from the durations (gaps 0.5s): seg1 0.0, seg2 18.740, seg3 40.408, seg4 66.540, seg5 102.080, seg6 124.540, seg7 162.408. (Segs 5–7 shift because seg 4 grew by 9.072s; seg 7 shifts again because seg 6 grew by 8.280s.)
- Captions match narration word-for-word — including "loop verified" lowercase and "minus-eight test". Re-run `make-srt.py` and check the cue count (was 39; seg 6 gains one cue, so expect 40) and the word count (432).

## Re-burn + frame verification (same as the 15 Nov fix pass)

- `assemble.sh` as updated above; burn captions with the same force_style (`PlayResX=1366,PlayResY=768,FontSize=26,MarginV=120` — the PlayRes fix from the fix pass; do not drop it or captions render ~2.7× too big again).
- ffprobe the finished file: must be ≤175s (target 174.168s) and ≤2:55; h264 1366×768 + AAC.
- Check frames at the new timestamps: seg-4 npm-test/O2-red handover, seg-6 console crop (GREEN literal, 20 runs, 897.68, both lower-thirds legible and not colliding with captions), end card (new numbers line, install command not covered by captions). Check captions sit above the lower-thirds throughout.
- Keep the draft (no-captions) cut as `kane-loop-demo-v3-draft.mp4` and the captioned file as `kane-loop-demo-v3.mp4`. Do NOT overwrite `kane-loop-demo.mp4` (the live v2) until the v3 upload is verified.

## Upload + link updates (after Olly approves the rebuilt video)

- Upload v3 to YouTube as **Unlisted** (same channel, same title pattern; description updated to 20 runs / 897.68 / LOOP_VERIFIED 16 Nov). Verify signed-out playback with audio + burned-in captions visible, as for v2.
- Update links in `docs/submission-pack-2026-11-19.md` (video URL) and `docs/x-launch-thread.md` post 6 (video URL).
- **X post 2's video link CANNOT be edited** (posted 17 Nov 08:03, https://x.com/OlsOls4/status/2122601447971774863). Leave the old video up — do NOT delete it — and add a **pinned comment on the OLD video** pointing to the new upload ("Re-recorded 17 Nov with the 16 Nov LOOP_VERIFIED result: <new URL>").
- Update `docs/video-script.md` status to FINAL v3 + append a v3 record to `video/BUILD_NOTE.md` (durations, what changed, verification done).
- Push the v3 script/audio/build files to the repo (bulk push, same exclusions as push 3 — no evidence/, no .testmuai/evidence/) only after the upload is verified.

## Human gates (standing rules)

1. Olly hears `video/narration-segs-467-new.mp3` FIRST — no rebuild before his ear approval.
2. Olly approves the rebuilt v3 video before any upload.
3. Upload is Unlisted, never Private; never submit a video judges cannot open.

## If stage 2 finds a problem

- If the assembled video exceeds 175s: trim still durations first (seg-6 clip-03 can shrink — the console crop needs ≥8s on screen for the two lower-thirds to be readable). Do not re-render audio. Do not cut narration without a new script edit + new audio + a fresh ear-check.
- If the deploy-9/10 console capture shows anything other than 20 runs / 897.68 / GREEN (literal): STOP and report — do not ship a frame that contradicts the submission.
- If the TTS spelling issue recurs anywhere (any all-caps token in new on-screen text that also enters narration): rewrite the spoken form in lowercase words, keep the token on screen only.

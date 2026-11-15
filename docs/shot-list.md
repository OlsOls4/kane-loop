# Shot list — Kane Loop video (≤3:00, Olly-voiced)

**Status:** DRAFT — supersedes prep 04's shot table where it conflicts (see the
correction note at the top of `docs/console-and-video.md`). This is the
**fallback cut** (no live Kane run yet). Tier B drop-ins live in
`docs/video-tier-b-dropins.md` — same slots, same timings.

## Shots (fallback cut)

| Time | Shot | Voice / on-screen text |
|---|---|---|
| 0:00–0:21 | Hook, in the browser: **zoomed crop on the ledger only** (14px text, below the fold at 1366×768 — never a full-page capture). Click Pay twice → ledger shows 2 orders, stock −2. | Narration §1. On-screen: `Seeded bug — disclosed. Reproduced locally.` + `2 orders, 1 checkout — charged twice`. |
| 0:21–0:36 | Real terminal: `npm install -g github:OlsOls4/kane-loop` then `kane-watch --help` (≥18pt). | Narration §2. Command on screen ≥18pt. |
| 0:36–1:12 | Loop Console (local, `npm run demo`): header + claim + sticky strip showing EXAMPLE, latest-run card, timeline. Bug reproduced locally in the embedded checkout. | Narration §3. Strip verdict word is EXAMPLE (never FAIL/PASS with an exit code). Banner above the card: `EXAMPLE — seeded run, not a live Kane run`. |
| 1:12–1:45 | Real terminal: `npm test` output (87 tests passing). Then the FIXTURE run_end, cropped, with the on-screen label for the whole shot. | Narration §4. On-screen: `FIXTURE — synthetic, not a live run`. Result code 740 shown as classifier output only. |
| 1:45–2:11 | Fixed build: mode toggle in the console; same double-click charges once; the 3-line diff in the pay handler. | Narration §5. On-screen: `Fixed build — mode toggle (demo switch, not an autonomous fix)`. |
| 2:11–2:40 | Pending / live-run diagram: watcher → Kane run → patch → replay → sweep → LOOP_VERIFIED, with the Kane-run step greyed out. | Narration §6. On-screen: `Kane credits: 0 — no live run yet` (≥5s). |
| 2:40–2:53 | End card: live URL (once deployed — placeholder until then), repo link, one run command, readable ≥5s. | Narration §7. |
| 2:53–2:58 | Buffer / fade. Ends ≤3:00. | — |

## Legibility & compliance rules

- Terminal ≥18pt; key numbers (totals, exit codes, credits) ≥24px.
- Crop to `run_end` + failing `remark` only; no dead time — every cut is a labelled jump cut with elapsed time.
- Manual captions, checked word-for-word against `docs/video-script.md`.
- Olly voices it; YouTube Unlisted (not Private); tested incognito at 1366×768 before submit.
- Judges stop watching at 3:00 — put the good part first (Luma FAQ).
- **Never film:** a fixture number as real (credits 12/14, durations, `example.invalid` test_url, illustrative "312/1,000 credits"); a step number in narration or captions ("the ledger check failed" only); the lines "Kane ran the checkout" / "No human in between" (Tier B only).
- **One failure, one fix, one green in the video.** Classifier, bounds, and anti-cheat get 5-second on-screen evidence each, not narration. Cut anything that needs >10 seconds to explain.

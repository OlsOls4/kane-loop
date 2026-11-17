# Kane Loop — submission pack (ready for Thu 19 Nov ~10:00 GMT)

Prepared 15 Nov 2026, freshened 17 Nov 2026 (Wave 5 + B7). Everything is ready: repo head 6aa214da (push 5 pending), deploy 10 live, video v3 up, both X posts live, fixer leg proven live on scratch. Only the submission itself remains (Thu 19 Nov ~10:00 GMT, needs Olly's approval).

## One-liner
Kane Loop is a veto gate: Kane CLI verifies every save, and only a separate verifier can call the code done.

## Project
- Name: **Kane Loop**
- Repo (public): https://github.com/OlsOls4/kane-loop (head 6aa214da, pushed 17 Nov 08:41)
- Live site: https://kane-loop-loopmart.vercel.app/ (deploy 10, GREEN literal console, 20 runs)
- Agent used: **Muse** (coding agent). Kane CLI is the verifier, not the agent.
- Video: **https://youtu.be/PB7Pbr5j5Uk** (ID PB7Pbr5j5Uk, Unlisted, 2:54, uploaded 17 Nov ~09:20, v3 cut incl. the 16 Nov gate run; captions burned in and visible). Draft file: build/kane-loop/video/kane-loop-demo-v3.mp4 (v2 at https://youtu.be/w1PQDDpR3hg stays up)

## Description (use docs/submission-paragraph.md verbatim — freshened 17 Nov)
115 unit tests passing (npm test), 20 live runs on the submitted build, 897.68 credits spent, balance 9,302.32. O1 real timer bug (740) → fixed → O1 green (100); O2 seeded double-charge (740) → fix (28 lines, 2 files) → O2 green (100); deploy-9 green O1 100 + O2 100; G1 probed live. 16 Nov: a save fired the gate end-to-end — replay 100 + independent sweep 100 → LOOP_VERIFIED, on the submitted build. 17 Nov: the fixer leg is proven live on scratch (kane-loop-scratch.vercel.app) — two 740 sweeps → gate dispatched the fix itself → redeploy → fresh gate run re-verified LOOP_VERIFIED (replay 100 + sweep 100, 1 order, stock −2). Narrowed caveat: the -6 test file still fails Kane's replay analyzer at step 18 (5×, Kane-side); the -8 test replays clean.

## Public posts (≥2 required)
- Post 1 (kickoff): **LIVE 16 Nov 19:02, verified verbatim** — https://x.com/OlsOls4/status/2122404847987130559
- Post 2 (Mon 17 Nov, Olly posts from his phone): **LIVE 17 Nov 08:03, verified verbatim** — https://x.com/OlsOls4/status/2122601447971774863 (two-part thread, corrected LOOP_VERIFIED version, 20 runs / 897.68 credits).
- Launch thread (Thu 19 Nov, after submission): docs/x-launch-thread.md — 6 posts, all ≤280 chars.

## SurveyMonkey form (https://www.surveymonkey.com/r/kane-cli-hackathon-submission)
Fields: project name, one-liner, description (above), agent used (Muse), YouTube demo video URL, ≥2 public post URLs, repo URL. Draft can be saved/updated until the deadline. **Submission needs Olly's explicit approval at the gate.**

## kaneclihack.sh Step 4 (https://www.kaneclihack.sh/o/team — solo team, captain, join code KANE-TFXSAL)
Same fields as SurveyMonkey. Project name currently prefilled "Olly McBride" — change to "Kane Loop".

## Deadline
Thu 19 Nov 2026, 23:59 IST = 18:29 GMT. Submit by ~10:00 GMT for buffer.

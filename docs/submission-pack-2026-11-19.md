# Kane Loop — submission pack (ready for Thu 19 Nov ~10:00 GMT)

Prepared 15 Nov 2026. The only outstanding item is the YouTube video URL (upload is waiting on Olly's phone tap: Yes, then 16).

## One-liner
Kane Loop is a veto gate: Kane CLI verifies every save, and only a separate verifier can call the code done.

## Project
- Name: **Kane Loop**
- Repo (public): https://github.com/OlsOls4/kane-loop (head 5b598e68, pushed 15 Nov 22:33)
- Live site: https://kane-loop-loopmart.vercel.app/ (deploy 8, GREEN console, 16 runs)
- Agent used: **Muse** (coding agent). Kane CLI is the verifier, not the agent.
- Video: **https://youtu.be/w1PQDDpR3hg** (ID w1PQDDpR3hg, Unlisted, 2:35, uploaded 15 Nov ~22:51, signed-out playback verified, captions burned in and visible). Draft file: build/kane-loop/video/kane-loop-demo.mp4

## Description (use docs/submission-paragraph.md verbatim — freshened 15 Nov)
100/100 tests, 20 live runs, 897.68 credits spent, balance 9,302.32. O1 real timer bug (740) → fixed → O1 green (100); O2 seeded double-charge (740) → fix (28 lines, 2 files) → O2 green (100); deploy-7 green O1 100 + O2 100; G1 probed live. 16 Nov: a save fired the gate end-to-end — replay 100 + independent sweep 100 → LOOP_VERIFIED, on the submitted build. Narrowed caveat: the -6 test file still fails Kane's replay analyzer at step 18 (5×, Kane-side); the -8 test replays clean.

## Public posts (≥2 required)
- Post 1 (kickoff): **LIVE 16 Nov 19:02, verified verbatim** — https://x.com/OlsOls4/status/2122404847987130559
- Post 2 (Mon 17 Nov, Olly posts from his phone): docs/x-post-2.md — 2-post thread, both ≤280 chars, real results + live console URL.
- Launch thread (Thu 19 Nov, after submission): docs/x-launch-thread.md — 6 posts, all ≤280 chars.

## SurveyMonkey form (https://www.surveymonkey.com/r/kane-cli-hackathon-submission)
Fields: project name, one-liner, description (above), agent used (Muse), YouTube demo video URL, ≥2 public post URLs, repo URL. Draft can be saved/updated until the deadline. **Submission needs Olly's explicit approval at the gate.**

## kaneclihack.sh Step 4 (https://www.kaneclihack.sh/o/team — solo team, captain, join code KANE-TFXSAL)
Same fields as SurveyMonkey. Project name currently prefilled "Olly McBride" — change to "Kane Loop".

## Deadline
Thu 19 Nov 2026, 23:59 IST = 18:29 GMT. Submit by ~10:00 GMT for buffer.

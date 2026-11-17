# X launch thread — Kane Loop (DRAFT ONLY, Olly posts it himself)

**Status:** DRAFT — do not publish. Olly posts from his own account.
Launch thread for submission day (Thu 19 Nov, after the SurveyMonkey form is
submitted). Six posts, each verified ≤280 chars. All figures are real live-run
results from 16 Nov 2026: 20 runs, 897.68 credits, LOOP_VERIFIED, deploy 9.
Repo is pushed (head 840ac753) and the video is published.

---

1/ Kane Loop is live for the #KaneCLIHackathon 🧵

Your AI agent says done. Kane Loop makes it prove it — or blocks the ship. A watcher any agent can install in one command; only a separate verifier can write LOOP_VERIFIED.

#KaneCLI @kane_cli @testmuai

2/ The victim: LoopMart, a tiny no-login checkout. Mug £15 + Hoodie £35, KANE10 −£5, total £45.

Double-click Pay and the same order was charged twice — two ledger orders, each stock down by two, total still £45. It looked done while the money was wrong underneath.

3/ The loop: kane-watch fires Kane CLI on every save, parses the NDJSON, and classifies on result code 740 — not the exit code.

First red → replay (~54 credits). Second identical red → one bounded patch (≤30 lines). Fix landed (28 lines, gate-verified); O2 green on retry.

4/ Green means twice: the same objective passed live AND a fresh chaos sweep where Kane derives the expected total itself.

A hard-coded total or a deleted assertion fails the sweep. Built to reject cheats (CHEAT_REJECTED + rollback in local tests).

5/ Honest caveat: one early test file trips Kane's own analyzer — a Kane-side bug, not ours — so the verified run uses the identical rebuilt file; hashes in the repo. The proof is LOOP_VERIFIED: replay pass (O1, 100) + independent O2 sweep (100).

6/ Try it: live console + repo below. One command starts the demo.

Repo: https://github.com/OlsOls4/kane-loop
Live console: https://kane-loop-loopmart.vercel.app/

Video below 👇 https://youtu.be/PB7Pbr5j5Uk

#KaneCLIHackathon #KaneCLI @kane_cli @testmuai

---

**Notes:** post 1 carries the hashtags + tags (required: at least two public posts
with #KaneCLIHackathon #KaneCLI and tags @kane_cli @testmuai). Post 6's links
are all real now — console live on deploy 10, repo at head 6aa214da (pushed
17 Nov 08:41), video v3 published https://youtu.be/PB7Pbr5j5Uk (v2 at
https://youtu.be/w1PQDDpR3hg stays up). Post 5's caveat
is load-bearing: replay passed on the -8 test, so LOOP_VERIFIED is a literal
claim now; the only remaining caveat is the -6 file tripping Kane's analyzer.

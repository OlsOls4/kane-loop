# X launch thread — Kane Loop (DRAFT ONLY, Olly posts it himself)

**Status:** DRAFT — do not publish. Olly posts from his own account.
Launch thread for submission day (Thu 19 Nov, after the SurveyMonkey form is
submitted). Six posts, each verified ≤280 chars. All figures are real live-run
results from 15 Nov 2026. Repo push must land before posting — do not claim
the code is pushed until it is.

---

1/ Kane Loop is live for the #KaneCLIHackathon 🧵

A watcher any agent can install in one command, that blocks on a diff, not on a claim. Your coding agent's "done" is provisional — only a separate verifier can write LOOP_VERIFIED.

#KaneCLI @kane_cli @testmuai

2/ The victim: LoopMart, a tiny no-login checkout. Mug £15 + Hoodie £35, KANE10 −£5, total £45.

Double-click Pay and the same order was charged twice — two ledger orders, stock down by two, total still £45. It looked done while the money was wrong underneath.

3/ The loop: kane-watch fires Kane CLI on every save, parses the NDJSON, and classifies on result code 740 — not the exit code.

First red → replay (~54 credits). Second identical red → one bounded patch (≤30 lines, no test edits). Fix landed (28 lines); O2 green on retry.

4/ Green means twice: the same objective passed live AND a fresh chaos sweep where Kane derives the expected total itself.

A hard-coded total or a deleted assertion fails the sweep. Cheat = CHEAT_REJECTED + rollback.

5/ Honest caveat: the literal replay leg is unproven — Kane's replay analyzer failed 3× (confirmed false, not the app). The proof is the fresh O1 pass (100) + the independent O2 sweep (100).

6/ Try it: one link, one command. Break it yourself.

Repo: https://github.com/OlsOls4/kane-loop
Live console: https://kane-loop-loopmart.vercel.app/

Video below 👇 [YouTube link once published]

#KaneCLIHackathon #KaneCLI @kane_cli @testmuai

---

**Notes:** post 1 carries the hashtags + tags (required: at least two public posts
with #KaneCLIHackathon #KaneCLI and tags @kane_cli @testmuai). Post 6's links
must be real at posting time — the console URL is live now; the repo URL is real
but the remote is still at the Day 1 commit until the push lands, and the video
link is a placeholder until Olly records it (18 Nov). Post 5's caveat is load-bearing:
never claim a replay pass — none exists.

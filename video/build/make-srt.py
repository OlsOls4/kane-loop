#!/usr/bin/env python3
"""Build captions.srt for the Kane Loop demo video (fix pass).
Timing: each segment's sentences share the segment's narration duration
proportionally to character count (Paloma @ speed 100, measured durations).
Caption text is the narration verbatim, word-wrapped at 42 chars/line.
Re-run after any re-recording, with the new measured durations.
Also prints the exact word count of the recorded narration.

Measured durations (ffprobe, v3 17 Nov):
  seg1 18.240, seg2 21.168, seg3 25.632, seg4 35.040,
  seg5 21.960, seg6 37.368, seg7 11.760; gaps 0.5s x6.
  Total 174.168s.
"""
import textwrap

SEGS = [
    ("seg1-hook", 0.0, 18.240, [
        "This checkout looks done.",
        "It isn't — and nobody checked.",
        "Watch: Pay is clicked twice.",
        "One checkout.",
        "Two orders in the ledger.",
        "Each stock down by two.",
        "The total on screen still says forty-five pounds — correct.",
        "The money underneath is wrong.",
    ]),
    ("seg2-install", 18.740, 21.168, [
        "Kane Loop is a watcher that blocks on a diff, not on a claim.",
        "One command installs it.",
        "One save starts the gate.",
        "It watches the repo: a save runs the gate, Kane checks the checkout, and a red verdict blocks the ship until the fix is verified.",
        "No dashboard, no 'trust me, it works.'",
    ]),
    ("seg3-bug", 40.408, 25.632, [
        "That double charge is the seeded bug — disclosed up front.",
        "LoopMart is a checkout with three products, one discount code, and one bug planted on purpose.",
        "But the first live run caught a real one first: Pay stuck on Processing, a timer detached from the window, so the payment never fired.",
        "The checkout was completely broken in a real browser — and the unit tests had missed it.",
        "Result code seven-four-zero.",
        "One fix later, the core flow went green.",
    ]),
    ("seg4-output", 66.540, 35.040, [
        "The loop itself runs on real output.",
        "One hundred tests pass — parser, classifier, the checkout, the fixer, the sweep.",
        "Twenty live runs, eight hundred ninety-eight credits spent — every number on screen is a real result.",
        "Then Kane ran the checkout live, and the ledger check failed: the same order charged twice.",
        "Result code seven-four-zero — the classifier's verdict, not a claim from the app.",
        "The gate needs two greens before it calls anything verified: the same test replayed, and a fresh sweep that works the total out itself.",
    ]),
    ("seg5-fix", 102.080, 21.960, [
        "The fix is one patch, twenty-eight lines across two files — a single-flight guard and an idempotency guard.",
        "The loop applies its own bounded patch for the bug class: one patch, no test edits.",
        "Toggle the mode and the same double-click charges once.",
        "What you are seeing is the fixed build.",
    ]),
    ("seg6-live", 124.540, 37.368, [
        "So what happened?",
        "Kane ran the checkout live.",
        "The core flow passed, and the chaos sweep went green on retry: one order, result code one hundred.",
        "Same test, same checkout — and Kane checked it a second, independent way.",
        "One hundred tests, twenty live runs, two independent green verdicts.",
        "And the ledger now survives a new order — verified live.",
        "A save fired the gate: replay passed on the minus-eight test, sweep passed — loop verified.",
        "One caveat: the older test file still trips Kane's analyzer — a Kane-side bug, not ours.",
    ]),
    ("seg7-end", 162.408, 11.760, [
        "Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim.",
        "Twenty live runs, loop verified.",
        "Try it — one link, one command.",
        "Break it yourself.",
    ]),
]

def fmt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def word_count(s):
    # Standalone punctuation tokens (the em-dash separators) are not words.
    return len([w for w in s.split() if any(c.isalnum() for c in w)])

total_words = 0
out = []
idx = 1
for name, start, dur, sentences in SEGS:
    total = sum(len(s) for s in sentences)
    t = start
    for i, s in enumerate(sentences):
        total_words += word_count(s)
        share = dur * len(s) / total
        end = start + dur if i == len(sentences) - 1 else t + share
        if i < len(sentences) - 1:
            end -= 0.06  # tiny gap between captions
        wrapped = "\n".join(textwrap.wrap(s, width=42))
        out.append(f"{idx}\n{fmt(t)} --> {fmt(end)}\n{wrapped}\n")
        idx += 1
        t = start + dur * sum(len(x) for x in sentences[: i + 1]) / total

path = "/home/hatch/workspace/goals/win-cash-with-kane-loop-at-testmu-kane-cli-hackathon/build/kane-loop/video/captions.srt"
with open(path, "w") as f:
    f.write("\n".join(out))
print(f"captions: {idx - 1} cues, {total_words} words total narration")
print(f"wrote {path}")

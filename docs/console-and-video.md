# Loop Console + Video + Submission Text

**Status:** SPEC ONLY — no code before 12 Nov. Console spec is frozen with `01` (12 Nov); video shot list is frozen 17 Nov (after Council Wave 3).

**Correction 15 Nov 2026 (council videographer):** the shot table in §3 assumes a Console and live Kane footage that do not exist yet, so it cannot be filmed honestly as written. The deliverable is the honest fallback cut in `docs/video-script.md` (full ~375-word narration, 2:50 + 5s buffer), with Tier B drop-ins in `docs/video-tier-b-dropins.md` if a live run lands before 18 Nov. The shot table below stays as the Tier B target only. Two errors in this doc are corrected and must not be repeated: (1) the failing step is **step 6, not step 4** — narration and captions say "the ledger check failed", never a step number; (2) fixture numbers (credits 12/14, durations, `example.invalid` test URLs, illustrative "312/1,000 credits") are never shown as real — any fixture on screen carries an on-screen "FIXTURE — synthetic, not a live run" label.

## 1. Loop Console — one-screen spec (Wave 2 UI/UX: IMPROVE over Wave 1)

**Wave 1's layout fails the judge tests as worded** (status strip *underneath* the checkout, 5-run timeline below that — on a judge's 1366×768 laptop the timeline is below the fold, so failing step + screenshot + fix cannot be found in <15s without scrolling and hunting). The loop is the product and the checkout is only the victim — **the strip must lead, not follow.**

### 1.1 Layout — first viewport, no scroll, desktop ≥1280px, three bands

1. **Header (one line):** `Kane Loop — LoopMart` + one sentence: *"A watcher any agent can install in one command, that blocks on a diff, not on a claim."* + verdict badge (word + exit code — see §1.2). (Wave 2 wording — do NOT use Wave 1's GuardianKane slogan "the agent cannot say it's done".)
2. **Loop status strip — full-width, sticky top, directly under the header.** Always visible while scrolling. This is the first thing a judge reads.
3. **Two columns below the strip:** left **LoopMart checkout (~55%)**, right **Loop Console (~45%)**. The Console column opens with the **latest-run detail card** (failing step + screenshot + fix — all three visible without a click), then the 5-run timeline as compact rows beneath it.

**Below the fold only:** raw NDJSON/logs behind a collapsed disclosure, evidence links, run journal. Nothing a judge needs for the 10s/15s tests lives below the fold.

**Mobile / narrow (<900px):** single column, same order — header → sticky strip → checkout → latest-run card → timeline → disclosure. No side-by-side, no horizontal scroll.

**10-second test (cold judge):** headline states the claim → strip states the current verdict in words (`FAIL — exit 1` / `PASS — exit 0`) → checkout total is a visible number (£45.00 correct vs the double-charge ledger). Passes, *if* the strip is on top and the total is large (≥24px).

**15-second test (failing step + screenshot + fix):** passes only because the latest-run card is in the right column in the first viewport — it must show, without expanding anything: failing step name, Kane's quoted remark (1–2 lines), the failure screenshot (thumbnail, circled), and the fix diff (≤10 lines, one file). Timeline rows are for history, not for this test; clicking a row swaps the detail card in place, never navigates away.

**Three specific fixes over Wave 1:** (a) strip on top, sticky, not underneath; (b) latest-run detail *above* the timeline, not inside it; (c) `Break it` and `Replay last failure` in the Console header next to the strip, not buried under the timeline.

### 1.2 Status strip — six states, icon + words + exit code (never colour alone)

| State | Strip text |
|---|---|
| WATCHING | `● WATCHING — no changes, waiting for a save` |
| RUNNING | `▶ RUNNING — Kane step 2 of 4: Apply KANE10…` (step name updates live) |
| FAIL | `✕ FAIL — exit 1 — the ledger check failed: ledger shows 2 orders, expected 1` (failing step + verbatim numbers; never a step number — the fixture's failing step is step 6, not step 4) |
| FIXING | `↻ FIXING — attempt 1 of 3 — patching pay handler…` |
| PASS | `✓ PASS — exit 0 — all 4 steps passed` |
| HUMAN-BLOCKED | `⏸ HUMAN-BLOCKED — 3 attempts used, needs a person` |

Also display, but route away from the coder: `DID NOT START — exit 2` and `TIMEOUT — exit 3`, with a human-readable cause. The strip is `aria-live="polite"` and always shows the current run's step, exit code, and time.

### 1.3 5-run timeline

Reverse-chronological, latest on top. Each row is a real `<button>` showing: run number + start time (`Run 7 · 14:02:11`), trigger (`Save` / `Break it` / `Replay`), verdict word + exit code, steps passed (`3/4`), failing step name or `All steps passed`, duration, and credits. Selecting a row swaps the detail card above it; the selected row is marked `Selected — showing above` in text.

### 1.4 Latest-run detail card (always visible, never empty)

Failing step name; Kane's verbatim `remark` quoted (1–2 lines, expandable); failure screenshot, circled, with caption `Kane's screenshot — the ledger check`; fix diff ≤10 lines naming one file; before/after ledger state (2 orders → 1 order, stock −2 → −1); rerun result; `run_id` and Test Manager `test_url` link.

### 1.5 `Break it` and `Replay last failure`

- **`Break it`:** button in the Console header, labelled `Break it — apply the double-charge bug`. One click: injects the seeded bug, resets the cart to Mug + Hoodie with KANE10 applied, immediately starts a Kane run (strip → RUNNING), and appends a timeline row ending FAIL. Idempotent and disabled while RUNNING or FIXING, with the disabled reason in text.
- **`Replay last failure`:** button beside it, labelled `Replay last failure — saved test, no new LLM credits`. Replays the saved `_test.md` for the last failed run; disabled with the text `No failed run to replay yet` when there is none. Never starts a fresh LLM-authored run.

### 1.6 Credits display

In the Console header, always as text: per-run (`This run: 12 credits`), session total, and budget (`312 / 1,000 credits used — 688 left` — figures are illustrative; use the *measured* Day 1 balance and thresholds from `03` §7), with a text warning at the warn threshold and a stop note at the hard stop. No colour-only bar.

### 1.7 NDJSON / logs

One collapsed native disclosure, labelled `Raw NDJSON and logs — Run 7`, below the timeline. Contains the cropped `run_end` JSON first, then scrollable NDJSON (max-height, `Copy` button). Collapsed by default; never auto-expanded. **No full NDJSON in the video at all** (see §2).

### 1.8 Never blank

On first load the timeline shows a seeded example run, labelled in the row and the detail card: `EXAMPLE RUN — seeded, not live. Press Break it to run a live one.` It is replaced by the first live run and drops off after five live runs. The checkout cart may be empty; the Console never is.

### 1.9 Keyboard-only pass

Tab order is header → `Break it` → `Replay last failure` → checkout controls → timeline rows → disclosure. Every control is a real button/link, visible focus ring, `aria-expanded` on rows/disclosure, Esc closes the disclosure. A keyboard-only tester must reach `Break it`, run it, and read the FAIL detail without a mouse.

## 2. Video shot list (target 2:45–2:55, hard cap 3:00)

Wave 1's shape is kept but tightened (UI/UX Wave 2): its FAIL (35s) and FIX (45s) sections are too long, and it allowed full NDJSON for up to 2s — **show no full NDJSON at all**. ~380 spoken words at ~150 wpm ≈ 2:32 of narration, leaving room for pauses and the end card. **Pre-recorded real fail + green runs, nothing staged after picture lock.** Olly voices it (no TTS — disqualification risk). Manual captions checked word-for-word (video must make sense on mute). YouTube **Unlisted** (not Private); tested incognito at 1366×768 before submit.

| Time | Shot | Voice / on-screen text |
|---|---|---|
| 0:00–0:10 | Hook, in the browser: click Pay twice → ledger shows 2 orders, stock −2. | "My coding agent just shipped this checkout. It looks done. It isn't — and nobody checked." On-screen: `2 orders, 1 checkout — charged twice`. |
| 0:10–0:25 | One sentence + strip appears; one install command visible. | "Kane Loop: a watcher any agent can install in one command, that blocks on a diff, not on a claim." Command on screen ≥18pt. |
| 0:25–0:55 | FAIL: labelled jump cut (`Jump cut — 41s elapsed`), Kane driving the checkout; cropped `run_end` only (`status: failed`, exit 1); failure screenshot, circled, 3s. | "Kane ran the checkout. The ledger check failed — the same order was charged twice." |
| 0:55–1:35 | FIX: failing `remark` quoted on screen; one-file diff highlighted; strip shows FIXING → RUNNING. | "No human in between. The loop hands Kane's exact failure to the coder — one patch, no test edits." |
| 1:35–2:15 | GREEN: same flow, confirmation `Total paid £45.00`, ledger 1 order; cropped `run_end` (`status: passed`, exit 0, duration + credits); evidence pack + `test_url`, 3s. | "Same test, same checkout. Green — and Kane checked it a second, independent way." |
| 2:15–2:45 | Ship: live URL + repo + one run command on a clean end card, readable ≥5s; credits line (measured figures, e.g. `312 / 1,000 credits`). | "Try it: one link, one command. Break it yourself." |
| 2:45–2:55 | Buffer / fade. Ends ≤3:00. | — |

**Legibility & compliance rules:** terminal ≥18pt, key numbers (totals, exit codes, credits) ≥24px; crop to `run_end` + failing `remark` only; no dead time — every cut is a labelled jump cut with elapsed time; manual captions checked word-for-word; Olly voices it; YouTube Unlisted (not Private); tested incognito at 1366×768 before submit; pre-recorded real fail + green runs, nothing staged after picture lock. Judges stop watching at 3:00 — put the good part first (Luma FAQ).

**One failure, one fix, one green in the video** (Wave 2 judges). Classifier, bounds, and anti-cheat get 5-second on-screen evidence each, not narration. Cut anything that needs >10 seconds to explain. Optional 10-second coda *only if the core is green*: the prompt-to-feature playground — do not let it delay the core.

## 3. One-paragraph submission description (draft — finalise 18 Nov)

> Kane Loop is a veto gate for AI coding agents, built for developers who use an agent to write code and want proof — not a promise — that it works. The agent's "done" is provisional: `kane-watch` fires Kane CLI on every save, parses the NDJSON run, and only a separate verifier process can write `LOOP_VERIFIED`, after replaying the committed `_test.md` suite and running a fresh independent chaos sweep in which Kane derives the expected total itself. Its demo victim is LoopMart, a tiny no-login checkout (Loop Mug £15, Debug Hoodie £35, Kane Notebook £10) where a double-click on Pay charges the same order twice — so a failure is a visible ledger error, not a missing class. Kane caught the seeded bug, the loop fixed it in one patch with no test edits, and the same suite then passed twice. The one-screen Loop Console shows the loop state, the failing step, Kane's screenshot, and the fix, with a `Break it` button so a judge can reproduce the failure live.

(Wave 2 note: this draft still uses Wave 1's "done is provisional" framing in its second sentence — finalise the wording on 18 Nov to lead with the Wave 2 framing, "blocks on a diff, not on a claim", and to name GuardianKane as prior art in the README, not in this paragraph. The paragraph must state: what was built, who it's for, which agent was used, and what Kane does in the flow — Luma's four required elements.)

## 4. README outline (for the repo — written 12–15 Nov, frozen 17 Nov)

1. **First paragraph — the differentiator (verbatim claim, must be true in the code):** "Unlike the official Kane skill, which runs a flow once and reports, Kane Loop adds diff-scoped objectives, a committed `_test.md` suite replayed instead of re-authored, credit budgeting against the measured account balance, 3-attempt escalation (plus a per-claim cap of 5) to a visible human-blocked state, an independent chaos sweep in which Kane derives the expected total itself, and anti-cheat (a fix that deletes an assertion or hard-codes a value fails) — with verdict-based gating on `result_code` 740. GuardianKane (August 2nd place) is prior art: it is a Claude Code Stop-hook gate; Kane Loop is an agent-agnostic watcher that gates on the git diff, and LoopMart is a disposable victim, not the product."
2. What it is / the one-sentence claim; 30-second judge path (live URL → `Break it` → FAIL → fix → PASS).
3. LoopMart: products, prices, the £50 → £45 math, the seeded double-charge bug (disclosed as seeded), the 4 assertions, the ledger/stock rules.
4. How the loop works: veto gate, `PROVISIONAL_DONE` vs `LOOP_VERIFIED`, classifier (exit 2 / flake / app bug / test bug), bounds (3 attempts per signature, 5 per claim, 5 runs/session, single-flight, debounce), fix contract, green-twice (replay AND independent), confirm-before-fix.
5. Install & run: one command, preflight (`whoami` / `balance` / `config show`), `npm run demo`, local preview vs deployed URL targets.
6. Credit budget: measured per-run cost, session total, replay costs ~0 LLM credits for unchanged steps.
7. Evidence: how to replay the suite in <30s, `evidence/` contents, run journal, `test_url` links, paired-experiment result (gated vs ungated).
8. Anti-cheat & second check: what is caught, with the deliberately-cheated test (16 Nov).
9. Known limits: Kane flakiness handling, what the loop does not do (no PRD tracker, no secret scan, no file locking — those are GuardianKane's; no `kane-cli explore`, Max plan only).
10. Repo map + licence note (no pre-12-Nov history).

**If time runs short, cut in this order:** the prompt-to-feature coda, the second-check polish, the run journal's static page — never cut the seeded bug, the replay, the latest-run card, or the captions.

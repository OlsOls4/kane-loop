# Kane Loop — Ready to Build (Prep Pack Index)

**Status:** PREP ONLY. No code, no repo, no commits, no spend, no contact. Written 9 Nov 2026.
**Build window:** 12 Nov 2026 14:30 PST (22:30 GMT) – 19 Nov 2026 13:30 PST (21:30 GMT).
**Working submission deadline:** 19 Nov 2026 23:59 IST (18:29 GMT) — **INFERRED, UNVERIFIED** (Luma body still shows stale 2/10 Nov lines; see `05-risks-and-checks.md`). **Submit by ~10:00 GMT 19 Nov.** Nothing after the deadline; submissions lock.
**Repo:** public GitHub `OlsOls4/kane-loop` — create ON or AFTER 12 Nov only; commit history is checked. It does not exist yet (re-verify at creation).
**Prizes:** $1,500 / $1,000 / $500, top three only. $3,000 total.

## Files in this pack

| File | Contents |
|---|---|
| `00-ready-to-build.md` (this file) | Index, one-page summary, scoring map, schedule, kickoff go/no-go |
| `01-loopmart-spec.md` | Full LoopMart app spec — products, flow, assertions, seeded bug, acceptance criteria |
| `02-kane-objectives.md` | Every Kane objective verbatim, with slugs, expected outcomes, and AGENTS.md rules |
| `03-loop-design.md` | Watcher / veto-gate design in prose + pseudocode — classifier, fix contract, caps, credits, journal |
| `04-console-and-video.md` | Loop Console one-screen spec, video shot list, submission paragraph, README outline |
| `05-risks-and-checks.md` | Risks, eligibility checklist, Day 1 kickoff checklist, what needs Olly |

Sources: Council Wave 1 synthesis (`../hidden_files/council-wave1-2026-11-09.md`), Council Wave 2 (judges, principal engineers, UI/UX, researchers — 9 Nov 2026, all four panels returned IMPROVE), Luma page (fetched 9 Nov), Kane AGENTS.md (mirrors CLI 0.9.0, fetched 9 Nov), GOAL.md. All scores below are **internal panel diagnostics, NOT real judge scores**; no win probabilities are claimed.

## The idea (confirmed, with Wave 2 fixes)

**Kane Loop: `kane-watch` as an enforced veto gate + LoopMart, a self-healing checkout, as its single demo victim, on one screen.**

Positioning (Wave 2 wording — do NOT use Wave 1's GuardianKane slogan "the agent cannot say it's done"):
> **A watcher any agent can install in one command, that blocks on a diff, not on a claim.** The coding agent's "done" is provisional; only a separate verifier process can mark a change verified — after replaying the committed `_test.md` suite **and** an independent chaos/defect sweep in which Kane derives the expected total itself.

**What changed from Wave 1 (Wave 2 surgery — all four panels agreed):**
1. **Tokens renamed.** Do NOT ship GuardianKane's `CLAIMED_DONE` / `KANE_VERIFIED` verbatim. Use `PROVISIONAL_DONE` (agent's claim) and `LOOP_VERIFIED` (verifier's verdict), plus `HUMAN_BLOCKED` and `CHEAT_REJECTED`. Cite GuardianKane by name as prior art in README §1 with the delta in one sentence.
2. **Second check is a chaos sweep, not a reworded replay.** Kane acts as an adversarial user — quantity 0/negative, double-click Pay, discount reuse, refresh mid-pay — and **derives the expected total itself** from the catalogue/prices via API/DevTools, never from the app's displayed total or the test's assertions. A hard-coded total or a healed test cannot pass it. (Closer to KANE vs. ABLE's independence than to GuardianKane's sweep.)
3. **Seeded bug changed.** Wave 1 seeded a double-discount total (£40.00). Researchers found TestMu's own 3 Nov Codex review already demoed a discount/quote-total bug in that shape — so the seeded bug is now **double-charge on double-click Pay / retry**: the same order is charged twice, the ledger shows two charges, stock is decremented twice, and a second confirmation is issued. Money with a persistent consequence. The discount math (£50 − £5 = £45) remains a named assertion; it is no longer the seeded bug. The seeded bug is disclosed as seeded; keep at least one genuine bug found during the build as well.
4. **Money persists.** Every order goes to a visible ledger + receipt (order ID, items, total, discount applied, confirmation state) and decrements stock. A wrong total must propagate to confirmation, receipt, and ledger — not just a page label.
5. **Veto is enforced, not a status file.** Gate at a real enforcement point (ship/commit blocked while unverified; visible blocked state). Proved by the unfixable-bug test: exactly 3 attempts, then human-blocked, no 4th run.
6. **Green-twice redefined (engineers' correction).** `GREEN = replay_pass AND independent_pass` — replaying the same recording twice proves determinism, not correctness. Two identical replays count as one pass plus a flake filter.
7. **Confirm-before-fix.** First red on a signature triggers an immediate zero-credit replay *before* any code change. Only a second identical red dispatches the fixer. This is the flake filter.
8. **Trust the verdict, not the exit code.** GuardianKane's author found exit codes lie: a replay can exit 1 while its final `run_end` reports `status: 'passed'`; a sweep can exit 0 while its verdict reports a confirmed bug. The classifier trusts `run_end.status` / `result_code` / `verdict` over the process exit code. With `--bug-detection`, a confirmed product bug arrives as **`result_code` 740 with a `verdict` object** — use 740 as the primary "real bug" signal.
9. **Two caps, not one.** Per-signature cap 3 attempts AND per-claim cap 5 attempts (a fixer that changes the failure mode must not mint a new signature and restart the count).
10. **Credit budgeting is relative, not absolute.** Warn/stop thresholds are computed from the *measured* Day 1 balance and reserve, not from the unverified 1,000. Replays are ~0 LLM credits *only if unchanged* — any re-authored/healed step costs; budget must assume heal/re-author costs.

**What was rejected (again, Wave 2):** MCP `verify_with_kane` server (invisible, worst video — park as add-on only); prompt-to-feature playground (most watchable, fails both tie-breaks — at most a 10s video coda if core is green); PRD-to-suite (now native Kane commands); booking/invoice/todo victims (booking non-deterministic solo, invoice less instantly comprehensible, todo explicitly warned against by Luma); browser-agent-in-the-wild (highest Craft ceiling, needs real third-party sites/auth/money, flaky and credit-hungry solo; game-player variant is a direct KANE vs. ABLE clone); `kane-cli explore` (0.10.0, Max plan, 3 sessions/licence — do not plan on it with free credits).

**Borrowed, with credit (Wave 2 researchers):** GuardianKane's **paired experiments** — same LoopMart spec, gated vs ungated build, show the gated build catching what the ungated build ships silently (run it, do not claim the idea); GuardianKane's **verdict-over-exit-code + process-group kill** (orphaned headless Chrome otherwise survives a timeout); demo.studio's **layered Kane use** (Kane as build partner during development *and* as the gate at runtime — show both briefly in the video); KANE vs. ABLE's **independence** (verifier derives the answer itself, handed no solution).

## Why it scores — the 4 judging dimensions (equal weight)

Judging: panel of TestMu AI engineers; 3 judges score independently, averaged; ties break on **Verified**, then **Closed loop**. (Luma, verified 9 Nov.)

| Dimension | How this entry hits it | Wave 2 internal diagnostic (pivot as drawn) | What the Wave 2 fixes must lift it to |
|---|---|---|---|
| **Ships** — working app, real end-to-end flow | One finished deterministic checkout (LoopMart, 4 clicks, no auth) + one-screen Loop Console; judge-reproduction path (canonical deployed URL, `npm run demo`, clean-clone no-Kane-login fallback with recorded evidence) | 6–7/10 — capped by fake pay / no persistence / two halves (tool + victim) | 7–8/10 — persistent ledger/receipt + stock, stable deployed URL, <30s judge path |
| **Verified** — Kane actually exercised the app and caught/confirmed something meaningful | Named assertions + committed `_test.md` replay + chaos sweep where Kane derives the total itself + anti-cheat + curated evidence; `--no-adaptive-heal` on the gate run; seeded bug disclosed + one genuine bug kept | 6–7/10 — capped by seeded-only bug, fake-pay consequence, second check not independent, replay = zero-discovery | 7–8/10 — double-charge with ledger propagation, independent derivation, cheat tests demonstrated |
| **Closed loop** — agent built, Kane verified, result fed back; tighter = higher | Enforced veto gate (not a watcher) + 4-way classifier + bounds + single-flight + fix contract + green-twice (replay AND independent) + confirm-before-fix | 7–8/10 — strongest dimension; capped by GuardianKane precedent (tightness is not novel) and by complexity | 8–9/10 — diff-scoped objectives + pre-commit/diff gate + auto-bisect on failure + verdict-based gating on result_code 740 |
| **Craft** — did you reach for something interesting? Would a dev install this tonight? | Installable `kane-watch` (one command, any agent/stack — not a Claude Code extension), `Break it` button, one-screen console, diff-scope + credit budgeting the official skill lacks | 5–6/10 — weakest; `kane-watch` is Luma Lane 2's first item, LoopMart generic, slogan is GuardianKane's | 7–8/10 — agent-agnostic watcher + diff gate + bisect are the differentiators; still the least certain dimension |

**Overall (internal diagnostics only):** Wave 1 projected ~7.5–8/10; Wave 2 judges mark the pivot *as drawn* at ~6–7/10 — in contention, not top-3. With the §4 fixes in this pack (renamed tokens, chaos sweep, persistent money, enforced veto, verdict-over-exit-code, two caps, confirm-before-fix), the panels' target is **7.5–8/10, in contention for top 3, IF the seeded bug, replay, and independent sweep actually work live.** Craft remains the least certain dimension.

**Submission bars (all three must clear — Luma):** (1) app works end to end; (2) Kane caught something OR proved something (failed run, or green run — NOT "installed but never run", NOT one trivial flow at the end); (3) agent and Kane talked to each other (agent output triggered a Kane run, or a Kane result triggered the agent to act).

## Schedule 12–19 Nov (all GMT unless stated)

| Day | Work | Exit criterion |
|---|---|---|
| **Wed 12 Nov** (window opens 22:30 GMT) | Kickoff ~2h: re-check inbox + Luma; `kane-cli whoami / balance / config show`; install + pin CLI (re-check latest — 0.10.3 provisional, see `05`); **create repo `OlsOls4/kane-loop`** (on/after 12 Nov only); freeze LoopMart spec + assertions (`01`); Day 1 parser fixture tests (see `03` §8); measure per-run credits (1 fresh author, 1 replay, 1 sweep); write the credit budget | Repo exists; CLI pinned; parser fixtures pass; budget written; no code before this day |
| **Thu 13 Nov** | Build LoopMart end-to-end + seed the double-charge regression; first manual Kane run fails on it (evidence #1); build failure classifier + loop bounds + single-flight as a dry-run harness (no console UI yet) | Manual Kane fail on the seeded bug, with red `run_end` + screenshot + `test_url` |
| **Fri 14 Nov** | Build the veto gate + fix contract + `testmd` replay loop; first unscripted edit → fail → patch → green with no human copy-paste, on a fresh clone | Unscripted fail → patch → green, journal shows the full trace |
| **Sat 15 Nov** | Independent chaos sweep + anti-cheat; Loop Console single screen (strip + latest-run card + timeline + `Break it` + `Replay last failure`); curated `evidence/` + run journal; Vercel deploy with canonical stable URL | Console passes the 10s/15s judge tests (`04`); deployed URL is the Kane target |
| **Sun 16 Nov** | Hardening: the 13 failure-mode tests in `03` §9 (flaky-red injection, unfixable bug = exactly 3 attempts, signature-change evasion, both cheat modes, healed-test negative control, parser edges, exit-1 upload failure, debounce/single-flight, watcher self-trigger, credit stop, clean-clone no-Kane-login, `Break it` determinism) | All 13 pass, or the failing ones are fixed / scope is cut with reasons recorded |
| **Mon 17 Nov** | **Freeze feature work.** Council Wave 3 (fresh review of the built entry, same panels) + fix round. Video rehearsal: pre-record the real fail + green runs | Wave 3 verdict + fix list; recorded fail + green in hand |
| **Tue 18 Nov** | Final verification (clean-clone run, one-command run, Vercel check); video script (~380 words); **Olly records/voices the ≤3-min video** (human gate) | Video ≤3:00, Unlisted, manual captions word-checked, incognito-tested at 1366×768 |
| **Thu 19 Nov ~10:00 GMT** | Submit via SurveyMonkey (repo, video, one-paragraph description, live URL/run command) | Submitted with buffer before the 18:29 GMT working deadline; nothing after it |

**Note on 14 Nov:** MeteredPay submission + TrapTest milestone also fall 14 Nov. Kane work is agent-parallel; Olly's human gates come first. The veto gate is the only 14 Nov must-do for Kane; the console can slip to 15 Nov without losing Verified.

**Credit rule throughout:** author each flow ONCE with `kane run --name`, then loop on `testmd run` replay. Never burn a fresh run to re-check something a replay can answer. Pre-record the video runs early if the budget is tight — do not burn the reserve re-shooting.

## Kickoff go / no-go checklist (12 Nov evening)

- [ ] Inbox + Luma re-checked: any deadline/credits correction? If a *credible earlier* deadline appears, it governs — submit by 10:00 GMT 19 Nov is the buffer, not the deadline.
- [ ] `kane-cli whoami` shows ollymcbride4 signed in (if not, Olly signs in — see `05`).
- [ ] `kane-cli balance` recorded (do NOT assume 1,000 or 10,000).
- [ ] CLI version pinned by `npm view` / `kane-cli --version` at kickoff; parser fixture tests pass (see `03` §8).
- [ ] Repo `OlsOls4/kane-loop` created (public, on/after 12 Nov), first commit is the frozen spec + this prep pack's *contents as docs* only — no pre-written app code.
- [ ] LoopMart spec + assertions frozen (`01`) — no spec changes after 13 Nov without a recorded reason.
- [ ] Per-run credit costs measured (fresh author, replay, sweep) and budget written (see `03` §7).
- [ ] If any go/no-go item fails: stop, record it, and cut scope per `05` §4 (cut order: prompt-to-feature coda → second-check polish → journal static page — never cut the seeded bug, the replay, the latest-run card, or the captions).

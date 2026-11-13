# Risks, Eligibility & Kickoff Checks

**Status:** PREP ONLY — 9 Nov 2026. Re-check every "unverified" item at kickoff (12 Nov) and record the outcome in the run journal.

## 1. Risks / blockers (ranked)

### HIGH
1. **Deadline is unverified.** Luma's body still says "Ship by 11:59 PM IST on 2 November" and "Submission deadline: 10 November, 11:59 PM IST" against a 12–19 Nov build window (re-checked 9 Nov 19:02 UTC — unchanged). The 19 Nov 23:59 IST (18:29 GMT) working deadline is an **inference**. The 10 Nov line cannot be real (build starts 12 Nov). Mitigation: submit by ~10:00 GMT 19 Nov (buffer); re-check inbox + Luma at kickoff and every morning; if a *credible earlier* deadline appears, it governs. **Needs Olly: approve asking the organisers (draft the ask) or accept the inferred deadline. Draft only — do NOT join Slack or message organisers without his approval.**
2. **Credits: 1,000 shown vs 10,000 advertised — UNVERIFIED and unreconciled.** Luma still advertises 10,000 free, valid one month; GOAL.md's 1,000 shown on the dashboard is unreconciled (dashboard under-report vs genuinely short account — unknown). Mitigation: measure on Day 1 (`kane-cli balance` + `run_end.credits_consumed`); replay-first mandatory; relative thresholds (see `03` §7); pre-record video runs early. Top-up route per Luma is "DM us on Slack" — again, needs Olly's approval to ask. **Needs Olly: decision if credits run low (ask organisers vs shrink scope).**
3. **Clone discount (Craft + Closed loop).** Judges file the entry as "GuardianKane again" and cap Craft at ~5 regardless of implementation quality. Mitigation (Wave 2): rename tokens, chaos sweep as second check, README para 1 names the difference in one sentence, video line states it in one sentence, cite GuardianKane as prior art, agent-agnostic watcher + diff gate + bisect as the differentiators. Do not quote GuardianKane's mechanism as the design.
4. **Staged-evidence discount (Verified, the first tie-break).** Seeded-only bug + fake pay caps Verified at ~6; ties break on Verified first. Mitigation: persistent ledger/receipt + stock decrement, double-charge mode, one genuine bug kept, seeded bug labelled, evidence pack with red + green `run_end` + `test_url` + screenshots, replayable without Kane login.

### MEDIUM
5. **CLI version drift (0.10.3 vs AGENTS.md 0.9.0).** AGENTS.md mirrors 0.9.0 (confirmed). Latest 0.10.3 (released 7 Nov) is **only secondary-verified** (Anchor Terminal live watch, 9 Nov 12:30 UTC; npmjs returned 403 on fetch 9 Nov, GitHub Releases search only surfaced up to 0.9.0 — stale crawl). `testmd run` terminal event, `--no-adaptive-heal` availability, exit-code semantics, and replay credit cost are all unverified on the pinned version. Mitigation: pin by `npm view` / `kane-cli --version` at kickoff 12 Nov, do not hard-code 0.10.3 anywhere; Day 1 fixture tests (see §3).
6. **Exit codes lie.** A replay can exit 1 while its final `run_end` reports `status: 'passed'`; a sweep can exit 0 while its verdict reports a confirmed bug (GuardianKane author, dev.to Part 1). Mitigation: classifier trusts `run_end.status` / `result_code` / `verdict` over the exit code; 740 as the primary "real bug" signal; parser fixtures (§3).
7. **Kane flakiness vs app bugs.** A flaky red that triggers a code change, or a healed test that masks a regression, destroys Verified. Mitigation: confirm-before-fix (O3), green-twice as redefined, `--no-adaptive-heal` on the gate run, classifier (§3 in `03`); verify with the seeded-bug and flaky-red tests on 16 Nov.
8. **Replay brittleness.** Recorded flows may not re-execute against a changed DOM (quantity change, re-render), making replay-first fail for mechanical reasons. Mitigation: freeze LoopMart DOM early; if replay is brittle on Day 1, fall back to one fresh run per verification and shrink scope.
9. **First authenticated Kane run.** No real authenticated run done yet; `kane-cli login --oauth` needs a browser. If the VM isn't signed in, Olly signs in on his own device or in a browser session — do not start routine browser sign-ins needing his authenticator/phone codes unless it's a validated blocker.
10. **Anti-cheat bypass.** Static diff scan alone is beatable; the dynamic sweep is the real defence and costs fresh-run credits each time. Mitigation: sweep only after replay pass; test both cheat modes on 16 Nov.
11. **Live-loop fragility / credit exhaustion.** Kane flakes, or the fresh sweep per attempt burns the unverified balance before final evidence, leaving no green run to show. Mitigation: replay-first mandatory (fresh run only to author; sweep only once per fix); measure Day 1 and publish the budget; pre-record the real fail + green runs early; clean-clone no-Kane-login fallback (app + recorded evidence) so Ships/Verified survive an auth failure.

### LOW
12. **Local/deployed divergence.** A fix green locally but red on the deployed URL (or vice versa) voids the judge replay. Mitigation: scripted deploy, final verification against the live URL.
13. **Runaway loop / watcher self-trigger.** A watcher that fires on its own outputs burns credits and corrupts the journal. Mitigation: ignore-list, single-flight, credit hard stop.
14. **State/journal corruption.** Concurrent writes or a killed run leaving a stale lock or half-written line. Mitigation: append-only JSONL, lock file with startup preflight, derived state only.
15. **Schedule pinch (14 Nov).** MeteredPay submission + TrapTest milestone collide with the veto-gate build day. Mitigation: LoopMart + classifier land 13 Nov; gate is the only 14 Nov must-do, console can slip to 15 Nov without losing Verified. Kane work is agent-parallel; Olly's human gates come first.
16. **Oct Hack Day confusion (separate event).** The Oct 24 Kane CLI Hack Day SF (in-person, OpenAI, $30,000+ prizes/credits, kaneclihack.sh / Devpost) has a separate rubric (25 pts × 4, GTM scored, Kane run report mandatory, Codex required, 2–4 min video). **Do not import its rules into the Nov online edition.** Its winners were not verified in this pass — unverified.

## 2. New Kane CLI facts since Wave 1 (Wave 2 researchers, 9 Nov — use, don't plan on, the unavailable ones)

- **`--bug-detection stop/continue` + `result_code` 740:** a confirmed product bug arrives as `result_code` 740 with a `verdict` object (Agent Mode docs; TestMu Codex review, 3 Nov 2026). Use 740 as the primary "real bug" signal. Verify the flag exists on the pinned CLI on Day 1.
- **DevTools assertions:** assert on network, console, cookies, localStorage, page-load budgets in plain English (e.g. "assert the request to /api/cart returned 200") — directly useful for LoopMart (assert the total via the API response, not just the DOM). Use in the chaos sweep where it strengthens independence.
- **`--analyzer-only` / `--condition`** for assertion-only checks — available, optional.
- **`kane-cli explore` (0.10.0, 28 Oct 2026):** up to 20 cloud browsers on HyperExecute, maps screens/flows, flags a11y/console/network/broken-link/perf findings. **KaneAI Max plan, 3 sessions/licence — do not plan on it with free credits; flag as unavailable unless verified at kickoff.**
- **Skill install:** `npx @testmuai/kane-cli-skill` confirmed in AGENTS.md. Skill package version 0.1.4 is secondary-sourced only — unverified from a primary source.
- **`--no-adaptive-heal`:** confirmed to exist, but scoped — it is a `testmd run` / `testrun run` flag only ("Turn off adaptive healing after a replay failure"). It does NOT apply to a fresh `kane run`. Healing is on by default: after a replay failure it retries up to three smaller windows, then re-authors authorable steps. Replay-only markers (`@db`, `@api`, `@js`, `@smartui`, `@network_query`, `@network_assertion`) survive heal; real-device runs have no heal.
- **"Fix → re-verify consumes ~0 LLM credits": conditional, not guaranteed.** AGENTS.md: later runs "replay each unchanged step from its recording with no LLM cost". Any re-authored step, healed step, or changed step uses credits. Budget must assume heal/re-author costs, not zero.
- **Assurance / PRD-to-suite is now native** (`context ingest`, `context review --verdicts`, `design tests`, `cover`, `maintain reconcile`; assurance streams end `done`, exit 3 = paused/resumable, not timeout). Lane 4 as a core product is still correctly rejected.

## 3. Day 1 kickoff checklist (Wed 12 Nov, window opens 22:30 GMT, ~2h)

- [ ] Re-check inbox (ollymcbride4@gmail.com) + Luma: any deadline/credits correction? Record the outcome.
- [ ] `kane-cli whoami` — signed in as ollymcbride4? If not, Olly signs in (see §5).
- [ ] `kane-cli balance` — record the number; do NOT assume 1,000 or 10,000.
- [ ] `kane-cli config show` — record the default project/folder (runs are saved as Test Manager test cases there).
- [ ] Install + pin CLI: `npm view @testmuai/kane-cli` / `kane-cli --version` at kickoff; record the pinned version; re-test `--agent` NDJSON, `run_end` vs `test_md_done`, and exit codes on the pinned version before relying on them.
- [ ] Parser fixture tests (see `03` §11): (1) 0.9.0 `run_end` stream, (2) `test_md_done` stream, (3) truncated timeout stream, (4) stream with an unknown event type injected. All four must pass before any loop code.
- [ ] Verify flags on the pinned CLI: `--no-adaptive-heal` on `testmd run`; `--bug-detection` (for 740); `--analyzer-only` / `--condition` (optional). Record which exist; adjust `02`/`03` if any is missing.
- [ ] **Create repo `OlsOls4/kane-loop`** (public, on/after 12 Nov only). First commit: frozen spec + this prep pack's contents as docs only — no pre-written app code. Verify the repo does not already exist before creating it.
- [ ] Freeze LoopMart spec + assertions (`01` + `02`); measure per-run credits (1 fresh author, 1 replay, 1 sweep); write the credit budget (`03` §7 table).
- [ ] Confirm the canonical deployed URL plan (Vercel) and the local-preview-vs-deployed target rule (`03` §12).
- [ ] If any item fails: stop, record it in the journal, and cut scope per §4.

## 4. Scope-cut order (if time or credits run short)

Cut in this order — never cut the items in the last line:
1. Prompt-to-feature playground coda (video, 10s).
2. Second-check polish (bisect, diff-scoping stretch goals).
3. Run journal's static page (keep the JSONL journal itself).
4. Paired experiment (O4) — evidence, not core.
5. `kane-cli explore` / Max-plan features (already excluded).
**Never cut:** the seeded bug, the replay, the latest-run card, the captions, the anti-cheat demonstration, or the judge-reproduction path.

## 5. Eligibility checklist (verify before submit, 19 Nov ~10:00 GMT)

- [ ] Repo created ≥12 Nov, commit history clean of pre-written code (no code, repo, or commits before 12 Nov).
- [ ] TestMu signup done + at least one Kane run on record (eligibility requirement — entries without a TestMu signup can't be scored; must have run Kane CLI).
- [ ] Video ≤3:00, Unlisted (not Private), incognito-tested at 1366×768, manual captions word-checked, Olly-voiced (no TTS).
- [ ] Live URL or one run command; judges see the app working in <30s; clean-clone no-Kane-login run shows the app + recorded red→green evidence.
- [ ] No login/paid dependency without working credentials + fallback/recording (LoopMart has none — verify this stays true).
- [ ] One submission per team (solo — Olly only).
- [ ] Submission form (SurveyMonkey): repo link, video link, one-paragraph description (see `04` §3, finalised 18 Nov), live URL/run command.
- [ ] Submissions lock at the deadline — no fixes after it. Nothing submitted after the deadline.

## 6. What needs Olly (human gates — nothing here is done without him)

| When | What | Why |
|---|---|---|
| 12 Nov (kickoff) | TestMu sign-in, if the VM isn't signed in (`kane-cli login --oauth` needs a browser) | First authenticated Kane run; no real authenticated run done yet |
| 12 Nov (kickoff) | Approve asking the organisers about the deadline (draft only), or accept the inferred 19 Nov 23:59 IST deadline | Luma body is stale; the working deadline is an inference |
| If credits run low | Decide: ask organisers (Slack DM — needs his approval to join/contact) vs shrink scope to replay-only | Credits 1,000 shown vs 10,000 advertised, unverified |
| 18 Nov | Record/voice the ≤3-min video himself (after picture lock, so narration matches the real runs) | Automated/TTS-voiced entries can be disqualified; if he cannot voice it, do NOT submit an AI-voiced cut |
| 19 Nov ~10:00 GMT | Approve the submission (repo, video, paragraph, live URL) before it is sent | One-shot submission; submissions lock at the deadline |

**Standing rules (do not break):** never message organisers or anyone else without Olly's approval (draft only); don't join Slack; ask before spending money; never top up OpenAI; use ollymcbride4@gmail.com only, never ollyjmcbride@gmail.com; run a user/UI/UX/judge review-and-improve loop before submitting (Council Wave 3 on the built entry, 17 Nov).

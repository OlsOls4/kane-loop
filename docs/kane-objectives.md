# Kane Objectives — Verbatim (frozen with `01`, 12 Nov)

**Status:** SPEC ONLY — no runs before 12 Nov. Objectives are natural-language text for `kane-cli run` / `testmd run`. They are the test suite: edit an objective and you have changed a test, which is a test bug unless the spec changed first (see `01` §7).
**Correction 15 Nov 2026 (principal engineer #10):** the seeded bug's canonical trigger is **double-click Pay during the Processing state only**. A retry after a confirmation is unreachable in a real browser (the pay section is hidden once a confirmation shows) — the earlier wording that listed retry as a trigger is withdrawn. The verbatim objectives live in `tests/objectives/` (`loopmart-checkout.objective.md`, `loopmart-chaos-sweep.objective.md`).

**URL placeholder:** every objective below starts with `<LOOPMART_URL>`. Substitute the canonical URL at kickoff (12 Nov): the **loop** runs against the local preview server rebuilt per attempt; the **gate/final verification** runs against the canonical deployed URL (see `03` §9). Never commit an objective with `localhost` hard-coded, and never commit a real deployed URL before the deploy exists — keep `<LOOPMART_URL>` in the committed `_test.md` files and resolve it from config at run time (or pass `--url`).

## AGENTS.md rules every objective and every run must follow

(From https://www.testmuai.com/kane-cli-agent/AGENTS.md, mirrors CLI 0.9.0, fetched 9 Nov 2026. Re-verify against the pinned CLI version on Day 1 — see `05`.)

- **Always pass `--agent`** to `kane-cli run` and `kane-cli testmd run`. It switches stdout to NDJSON, one JSON event per line. Without it (or stdin redirect) a run can open a terminal view that never exits.
- **The `run` subcommand is mandatory.** `kane-cli "<objective>"` does not work and exits 2.
- **Every run needs a start URL.** Start the objective with the site, or pass `--url`.
- **Tag every command** with the runtime: prefix `KANE_CLI_USER_AGENT=<agent>` inline on each command (an `export` does not survive between shell calls in most agent hosts).
- **End every flow in an assertion about what is on screen** (`verify the confirmation shows Total paid £45.00`), not in a click. A run with no verify/assert gets no replayable pass/fail. Assert the *outcome*, not the trigger: do not write "verify the Pay button is visible" — the button goes away when paying works, so that check fails on success.
- **Use "store as" to extract data** (`store the displayed total as 'total'`); "read/tell me the price" does not reliably capture a value. Refer to a stored value in plain English (`the stored total value`), never as `{{total}}`. `{{name}}` is only for variables/secrets.
- **If an element appears only sometimes** (e.g. a cookie banner), write the step as a condition: `if a cookie banner is visible, close it`.
- **Keep one objective under ~15 steps.** Split longer flows into separate runs.
- **Objectives must never need input mid-run.** Prompts are disabled when stdin is not a terminal, so a step that waits for an answer fails.
- **Dollar sign in a double-quoted objective:** write `\$` (bash turns an unescaped `$42.00` into `2.00`). This spec uses £, so the risk is low — but keep it in mind for any `$` in future objectives.
- **Never ask for an access key, password, or token in chat, and never echo one back.** Secrets go in a variables file the user fills in. LoopMart has no login, so no variables file is needed for the core flows.
- **Browser runs take 30 seconds to a few minutes.** Give the shell a long timeout (up to 10 minutes).
- **Never write test cases by hand, in chat or in scratch files** — except that *these objectives are the design input*: the test cases themselves come from running `kane run --name <slug>`, which authors the `_test.md` from the objective. Do not hand-author `_test.md` files; author them once with `--name`, then replay.

## Reading output and exit codes (Wave 2 correction — trust the verdict, not the exit code)

- Stdout is NDJSON. On 0.8.17+ the first line is `{"type":"stream_start", ...}`.
- Progress events have `step`, `status` (`running`, `done`, `failed`) and `remark`, and no `type` field. Typed events have a `type`: `bifurcation`, `child_agent_start`, `child_agent_end`, `ask_user`, `recording_state`, `error`, `warning`, `project_folder_auto_defaulted`, and finally `run_end`.
- **`run_end` is the last line of a `kane run` that started.** Fields to rely on: `status`, `summary`, `one_liner`, `reason`, `duration`, `credits_consumed`, `final_state` (stored values), `test_url`, `session_dir`. `run_dir` is legacy — that folder is no longer created.
- **`testmd run` ends with `test_md_done`** (`overall_status`, `duration_s`, `session_id`, `share_url`) — a `run_end` inside a testmd stream only finishes one step. **`testrun run` ends with `testrun_done`** (+ `remote_done` on `--remote`). Assurance streams end in `done`. **The parser must branch on the command/surface** — GOAL.md's blanket "final line is `run_end`" is oversimplified and wrong for testmd/testrun.
- **Exit codes lie (Wave 2 researchers, GuardianKane author, dev.to Part 1, 22 Sep 2026):** a replay can exit 1 while its final `run_end` reports `status: 'passed'`; a sweep can exit 0 while its verdict reports a confirmed bug. **The classifier trusts `run_end.status` / `result_code` / `verdict` over the process exit code.** With `--bug-detection`, a confirmed product bug arrives as **`result_code` 740 with a `verdict` object** — use 740 as the primary "real bug" signal.
- Exit codes for `kane run` (check the exit code first; no `run_end` = the run did not start):
  - `0` — Passed (but see "exit codes lie" — confirm against `run_end.status`).
  - `1` — Failed: the objective ran but did not pass, OR the upload failed. **Exit 1 conflates app failure with upload failure** — if `run_end.reason` matches an upload/evidence/seal failure, or status is failed with no failing step recorded, classify as DIDNT_START, not APP_BUG (see `03` §2).
  - `2` — Did not start: sign-in, configuration, no start URL, Chrome, network, or an unknown subcommand. Nothing ran and **no credits were used**.
  - `3` — Timeout or cancelled (for `kane run`). For `testrun run`, exit 3 means **cancelled only (no suite timeout)** — do not apply run-timeout logic to testrun.
- A run refused before it starts can exit 2 with no `run_end`, so check the exit code first. A `{"type":"warning","code":"unresolved_variables",...}` line means a `{{name}}` has no value — the run still goes ahead and types the name as written, so fix the variable before trusting the result. Ignore fields/event types you do not recognise; new ones can appear in any release.
- Every run that starts seals a `.evidence` pack (per-step screenshots, network/console logs, run logs, failure records). A one-off run keeps it under `<session_dir>/evidence/` and copies it to `.testmuai/evidence/` when the run has `--name`; `testmd run` / `testrun run` put it in `.testmuai/evidence/`. Do NOT commit `.testmuai/evidence/` — curate into `evidence/` instead (see `03` §8, `04` §5).

## Objectives

### O1 — Core checkout flow (the main flow; authors the saved test)

- **Slug:** `--name loopmart-checkout` → `.testmuai/tests/loopmart-checkout_test.md` + `output-loopmart-checkout/`. Commit both.
- **Purpose:** the primary flow; the assertion set A1–A4 in `01` §4. This is the flow the loop replays, the gate runs, and the video shows.
- **Objective (verbatim):**

> Go to <LOOPMART_URL>, verify the page shows three products named Loop Mug, Debug Hoodie, and Kane Notebook with prices £15.00, £35.00, and £10.00, and verify the cart is empty. Click Add to cart on Loop Mug, then verify the cart shows 1 Loop Mug and the subtotal is £15.00. Click Add to cart on Debug Hoodie, then verify the subtotal is £50.00. Type KANE10 into the discount code field and click Apply, then verify the discount is minus £5.00 and the total is £45.00. Store the displayed total as 'total'. Click the Pay button, wait for the confirmation, then verify the confirmation shows Total paid £45.00 and an order number. Verify the order ledger contains exactly one order for this checkout with the same items, discount, and total as the confirmation, and verify the stock count for Loop Mug and Debug Hoodie has each decreased by exactly 1.

- **Steps:** ~10 — within the ~15-step limit.
- **Expected `run_end` on the green app:** `status: passed`, exit 0. `final_state.total` = `£45.00`.
- **Expected `run_end` with the seeded double-charge bug active:** `status: failed`, exit 1 — failing step is the ledger/stock assertion (A4/A5), NOT the total assertion (A1–A3 still pass). That is the designed signature: correct total on screen, wrong money underneath.
- **What a fail means:** if the failing step is A1–A3 (subtotal/discount/confirmation total) → a different bug from the seeded one (genuine bug — keep it, see `01` §5). If the failing step is A4/A5 → the seeded double-charge, or a genuine ledger/stock bug. The classifier in `03` §2 routes by failing step + `remark`, never by exit code alone.
- **Run command (loop authoring, once):** `KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --name loopmart-checkout --timeout 120`
- **Run command (loop replay, every iteration):** `KANE_CLI_USER_AGENT=<agent> kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal` — **verify `--no-adaptive-heal` exists on `testmd run` in the pinned CLI on Day 1**; it is a `testmd run` / `testrun run` flag only and does NOT apply to a fresh `kane run`. If it does not exist on the pinned version, the gate must use `kane run` with the saved test, or disable adaptive healing in config — and the README must say which. A healed test masking a regression destroys Verified.

### O2 — Independent chaos / defect sweep (the second check)

- **Slug:** `--name loopmart-chaos-sweep` → `.testmuai/tests/loopmart-chaos-sweep_test.md` + `output-loopmart-chaos-sweep/`. Commit both.
- **Purpose:** the genuinely independent second check. Kane acts as an adversarial user and **derives the expected total itself** — it must compute the expected total from the catalogue prices (shown on the page / via the API response), NOT copy the app's displayed total and NOT reuse O1's assertions or fixtures. Different wording, different cart (different products/quantities/discount), different expected values. This is what makes a hard-coded total or a deleted discount branch fail the sweep even if it passes the replay. (Closer to KANE vs. ABLE's independence than to GuardianKane's reworded sweep.)
- **Objective (verbatim):**

> Go to <LOOPMART_URL> and read the prices shown for each product on the page. Add 2 Kane Notebooks and 1 Loop Mug to the cart. Work out the subtotal yourself from the prices you read, apply the discount code KANE10, and work out the total yourself from the subtotal and the 10 percent discount. Verify the cart total shown on the page matches the total you worked out. Then set the Loop Mug quantity to 0, verify the cart updates to show only the notebooks and the total matches the total you work out for 2 notebooks with the discount applied. Then click the Pay button twice in quick succession, wait for the confirmation, and verify the order ledger contains exactly one order for this checkout and the stock count for Kane Notebook has decreased by exactly 2 and no other product stock has changed.

- **Expected `run_end` on the green app:** `status: passed`, exit 0. The sweep is the anti-cheat: a hard-coded £45.00 total, a deleted discount branch, or a double-charge all fail it.
- **Expected `run_end` with the seeded bug active:** `status: failed`, exit 1 — failing step is the ledger/single-charge assertion (double-click Pay creates two orders / stock −4). **With `--bug-detection`, a confirmed product bug should arrive as `result_code` 740 with a `verdict` object — treat 740 as the primary "real bug" signal, over the exit code.**
- **What a fail means:** APP_BUG (if the app misbehaves) or TEST_BUG (if the objective is ambiguous — e.g. Kane cannot read a price, or the quantity stepper behaves differently from the wording). The classifier routes by failing step + `remark` (see `03` §2). The sweep runs **only after a replay pass**, so it is paid for once per genuine fix, not per attempt.
- **Run command (authoring, once):** `KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --name loopmart-chaos-sweep --timeout 120 --bug-detection continue`
  - Note: `--bug-detection` is a newer flag (see `05` §2) — verify it exists on the pinned CLI on Day 1; if it does not, drop it and rely on `run_end.status`/`verdict`. Do not let a missing flag block the sweep.
- **Run command (sweep, per fix):** `KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --timeout 120 --bug-detection continue` (fresh run each time — it is an independent check, not a replay).

### O3 — Confirm-before-fix replay (the flake filter)

- **Slug:** none (no `--name`) — this is a replay of O1's saved test, not a new test.
- **Purpose:** first red on a signature triggers an immediate zero-credit replay *before* any code change (engineers' correction, Wave 2). Only a second identical red dispatches the fixer. This stops a flaky red from causing a spurious "fix".
- **Run command:** `KANE_CLI_USER_AGENT=<agent> kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal`
- **Expected:** `test_md_done` with `overall_status: passed` → the first red was a flake; log `FLAKE → replay → PASS`, consume no attempt, make no code change. `overall_status: failed` with the same failing step → dispatch the fixer (see `03` §3).

### O4 — Paired experiment (gated vs ungated — borrowed method, credited)

- **Slug:** `--name loopmart-ungated` (a copy of O1 run against an *ungated* build — same LoopMart spec, no `kane-watch` running).
- **Purpose:** GuardianKane's paired-experiment method (borrowed, credited in the README): same spec, gated vs unassisted build, show the gated build catching what the ungated build ships silently. Run once, during the build (15 Nov), not in the loop.
- **Objective:** identical to O1, run against the ungated build with the seeded bug active.
- **Expected:** `status: failed` on the ledger assertion — and, crucially, the ungated build *ships* that failure silently (no gate, no verdict). The paired result is evidence for the video/README: "the same bug, with no gate, ships; with the gate, it is caught, fixed, and re-verified."
- **Cost:** one fresh run + one replay. Budget it in `03` §7.

### O5 — Judge-reproduction replay (the <30s path)

- **Slug:** none — replays O1 + O2's saved tests via `testrun run`.
- **Purpose:** the README's judge path: replay the suite in <30s from a clean clone.
- **Run command:** `KANE_CLI_USER_AGENT=<agent> kane-cli testrun run --match '^tests[/\\]' --headless --agent` (do NOT loop `testmd run` in bash for two or more saved tests — `testrun run` produces one summary, one exit code, one evidence pack, ending in `testrun_done`).
- **Expected:** `testrun_done`, exit 0, all tests passed. **Note:** `testrun run` exit 3 means cancelled only (no suite timeout) — do not apply run-timeout logic to testrun.
- **Dry-run first:** `kane-cli testrun run --tags smoke --dry-run --agent` previews the plan and runs nothing. Use `--dry-run` before any `--remote` run (remote needs the HyperExecute plugin and a subscription — do not plan on remote).

## Objective inventory (for the journal + README)

| Objective | Slug | File | Authoring cost | Replay cost | When it runs |
|---|---|---|---|---|---|
| O1 core checkout | `loopmart-checkout` | `tests/loopmart-checkout_test.md` | 1 fresh run | ~0 (unchanged steps) | Author once (12–13 Nov); replay every loop iteration; gate run |
| O2 chaos sweep | `loopmart-chaos-sweep` | `tests/loopmart-chaos-sweep_test.md` | 1 fresh run | n/a (fresh each time) | Author once; fresh run once per genuine fix (after replay pass) |
| O3 confirm replay | — | replays O1 | 0 | ~0 | On every first red, before any code change |
| O4 paired experiment | `loopmart-ungated` | `tests/loopmart-ungated_test.md` | 1 fresh run | ~0 | Once, 15 Nov, against the ungated build |
| O5 judge replay | — | `testrun run` over `tests/` | 0 | ~0 | README path; final verification 18 Nov |

**Total fresh authoring runs to budget for:** 3 (O1, O2, O4) + 1 sweep per genuine fix + final evidence runs. Everything else is replay. If a replay consumes credits on Day 1 (verify!), the whole replay-first budget is wrong — shrink scope to one flow and one fresh verification run, and rewrite the budget (see `03` §7, `05` §4).

# O2 — Independent chaos / defect sweep (objective text, verbatim from prep 02 with the 15 Nov retry rewording)

**Status:** OBJECTIVE TEXT ONLY — not yet authored by `kane run --name`.
Do NOT hand-author `tests/loopmart-chaos-sweep_test.md`; author it once with
`kane run --name loopmart-chaos-sweep` when Kane sign-in + credits resolve.
This file is the design input.
**URL placeholder:** `<LOOPMART_URL>` is resolved from config at run time
(or passed with `--url`). Never commit a `localhost` URL.

**Slug:** `--name loopmart-chaos-sweep` → `.testmuai/tests/loopmart-chaos-sweep_test.md` + `output-loopmart-chaos-sweep/`. Commit both.

**Purpose:** the genuinely independent second check. Kane acts as an adversarial user and
**derives the expected total itself** — it must compute the expected total from the catalogue
prices (shown on the page / via the API response), NOT copy the app's displayed total and
NOT reuse O1's assertions or fixtures. Different wording, different cart (different
products/quantities/discount), different expected values. This is what makes a hard-coded
total or a deleted discount branch fail the sweep even if it passes the replay.

**Objective (verbatim):**

> Go to <LOOPMART_URL> and read the prices shown for each product on the page. Add 2 Kane Notebooks and 1 Loop Mug to the cart. Work out the subtotal yourself from the prices you read, apply the discount code KANE10, and work out the total yourself from the subtotal and the 10 percent discount. Verify the cart total shown on the page matches the total you worked out. Then set the Loop Mug quantity to 0, verify the cart updates to show only the notebooks and the total matches the total you work out for 2 notebooks with the discount applied. Then click the Pay button twice in quick succession, wait for the confirmation, and verify the order ledger contains exactly one order for this checkout and the stock count for Kane Notebook has decreased by exactly 2 and no other product stock has changed.

**Seeded-bug trigger (canonical):** double-click Pay during the ~1s Processing
state (the "twice in quick succession" in the objective). A retry after a
confirmation is NOT a trigger: unreachable in a real browser (the pay section
is hidden once a confirmation shows) — corrected 15 Nov 2026.

**Expected `run_end` on the green app:** `status: passed`, exit 0. The sweep is the
anti-cheat: a hard-coded £45.00 total, a deleted discount branch, or a double-charge
all fail it.

**Expected `run_end` with the seeded bug active:** `status: failed`, exit 1 — failing step
is the ledger/single-charge assertion (double-click Pay creates two orders / stock −4).
**With `--bug-detection`, a confirmed product bug should arrive as `result_code` 740 with a
`verdict` object — treat 740 as the primary "real bug" signal, over the exit code.**

**What a fail means:** APP_BUG (if the app misbehaves) or TEST_BUG (if the objective is
ambiguous — e.g. Kane cannot read a price, or the quantity stepper behaves differently
from the wording). The classifier routes by failing step + `remark`. The sweep runs
**only after a replay pass**, so it is paid for once per genuine fix, not per attempt.

**Run command (authoring, once):**
`KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --name loopmart-chaos-sweep --timeout 120 --bug-detection continue`

**Run command (sweep, per fix):**
`KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --timeout 120 --bug-detection continue`
(fresh run each time — it is an independent check, not a replay).

**Local equivalent (no Kane, no credits):** `node kane-watch/test/run-sweep.cjs` runs the
same probes deterministically against LoopMart logic (`kane-watch/src/sweep.js`).
The local run is labelled as such; it is not a Kane run.

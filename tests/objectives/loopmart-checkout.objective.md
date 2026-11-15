# O1 — Core checkout flow (objective text, verbatim from prep 02 with the 15 Nov retry rewording)

**Status:** OBJECTIVE TEXT ONLY — not yet authored by `kane run --name`.
Do NOT hand-author `tests/loopmart-checkout_test.md`; author it once with
`kane run --name loopmart-checkout` when Kane sign-in + credits resolve,
then replay it with `testmd run`. This file is the design input.
**URL placeholder:** `<LOOPMART_URL>` is resolved from config at run time
(or passed with `--url`). Never commit a `localhost` URL, and never commit
a real deployed URL before the deploy exists.

**Slug:** `--name loopmart-checkout` → `.testmuai/tests/loopmart-checkout_test.md` + `output-loopmart-checkout/`. Commit both.

**Purpose:** the primary flow; the assertion set A1–A4 in `docs/loopmart-spec.md` §4.
This is the flow the loop replays, the gate runs, and the video shows.

**Objective (verbatim, with the retry rewording of 15 Nov 2026):**

> Go to <LOOPMART_URL>, verify the page shows three products named Loop Mug, Debug Hoodie, and Kane Notebook with prices £15.00, £35.00, and £10.00, and verify the cart is empty. Click Add to cart on Loop Mug, then verify the cart shows 1 Loop Mug and the subtotal is £15.00. Click Add to cart on Debug Hoodie, then verify the subtotal is £50.00. Type KANE10 into the discount code field and click Apply, then verify the discount is minus £5.00 and the total is £45.00. Store the displayed total as 'total'. Click the Pay button, wait for the confirmation, then verify the confirmation shows Total paid £45.00 and an order number. Verify the order ledger contains exactly one order for this checkout with the same items, discount, and total as the confirmation, and verify the stock count for Loop Mug and Debug Hoodie has each decreased by exactly 1.

**Steps:** ~10 — within the ~15-step limit.

**Seeded-bug trigger (canonical):** double-click Pay during the ~1s Processing
state. The second click queues a second charge; the ledger shows two orders
and stock decrements twice. A retry after a confirmation is NOT a trigger:
it is unreachable in a real browser (the pay section is hidden once a
confirmation shows) and the handler ignores it — the 12 Nov wording that
listed retry as a trigger was corrected 15 Nov 2026 (principal-engineer
finding #10).

**Expected `run_end` on the green app:** `status: passed`, exit 0. `final_state.total` = `£45.00`.

**Expected `run_end` with the seeded double-charge bug active:** `status: failed`, exit 1 —
failing step is the ledger/stock assertion (A4/A5), NOT the total assertion (A1–A3 still pass).
That is the designed signature: correct total on screen, wrong money underneath.
The failing step is named "the ledger check failed" in narration — never a step
number (the fixture's failing step is step 6, not step 4).

**What a fail means:** if the failing step is A1–A3 (subtotal/discount/confirmation total) →
a different bug from the seeded one (genuine bug — keep it). If the failing step is A4/A5 →
the seeded double-charge, or a genuine ledger/stock bug. The classifier routes by
failing step + `remark`, never by exit code alone.

**Run command (loop authoring, once):**
`KANE_CLI_USER_AGENT=<agent> kane-cli run "<objective>" --agent --headless --name loopmart-checkout --timeout 120`

**Run command (loop replay, every iteration):**
`KANE_CLI_USER_AGENT=<agent> kane-cli testmd run tests/loopmart-checkout_test.md --agent --headless --no-adaptive-heal`

# LoopMart — App Spec (frozen at kickoff, 12 Nov)

**Status:** SPEC ONLY — no code written before 12 Nov. Freeze this spec on 12 Nov evening; no spec changes after 13 Nov without a recorded reason.
**Purpose:** LoopMart is the demo victim for Kane Loop. It is NOT the product — the product is `kane-watch`, the veto gate. LoopMart exists to be broken, caught, and fixed in front of a judge. Every design choice below serves that: money math a judge can do in 2 seconds, failures that are visible numbers with persistent consequences, and a flow with no auth, no login, no randomness.

## 1. What LoopMart is

A tiny single-page store. Three products, a cart, a discount code, a fake payment, an order confirmation, and a visible order ledger. One page, no navigation, no auth, no login, no email, no account. All state is seeded and deterministic: no random values, no timestamps inside totals, order numbers sequential from `LOOP-1001` within a session.

**Why a checkout (Wave 2 judges + researchers):** money math is understood in 2 seconds; a wrong total is a visible, costly, externally checkable outcome. Booking (double-booking race) is harder to make deterministic solo in 7 days; an invoice is checkout with less instant comprehension; a todo app is explicitly warned against by Luma. Checkout remains the best victim.

## 2. Products

| Product | Price | Notes |
|---|---|---|
| Loop Mug | £15.00 | Core flow product |
| Debug Hoodie | £35.00 | Core flow product |
| Kane Notebook | £10.00 | Used by the chaos sweep (different product mix); not in the core flow |

All prices are round numbers. Core Kane flow uses Mug + Hoodie only.

**Core-flow arithmetic (the judge does this in 2 seconds):**
- Subtotal: £15.00 + £35.00 = **£50.00**
- Discount code **KANE10** = 10% off = **−£5.00**
- Total: **£45.00**
- Other checks a judge can do: one of each product = £60.00 − £6.00 = **£54.00**; Mug alone = £15.00 (no discount without the code); Hoodie alone = £35.00.

## 3. Page structure (single page, left column of the one-screen console — see `04`)

Three sections, stacked in the left column:

### 3.1 Products
Three cards, each with name, price, and one `Add to cart` button. After adding, the button reads `Added ✓ — 1 in cart` (text, not colour only) and a `+ / −` stepper appears. Quantity steppers are real: changing quantity re-computes line totals, subtotal, discount, and total immediately.

### 3.2 Cart & discount
- Line items with quantity steppers and line totals.
- `Subtotal`, `Discount (KANE10)`, and a large `Total` (≥24px).
- Discount field with an `Apply` button. A wrong code shows `Code not recognised — try KANE10` in text. Applying KANE10 twice must not double-apply (see §5 — the *seeded* bug is elsewhere).
- Cart starts empty with the text `Cart is empty — add a product to start.`
- A labelled shortcut `Demo: add Mug + Hoodie` fills the core cart in one click for a human judge. **The Kane flow never uses it** — Kane adds each product by clicking, so the flow exercises the real UI.

### 3.3 Fake pay & confirmation
- Name `Test Buyer`, card `4242 4242 4242 4242`, expiry `12/30`, CVC `123` — all pre-filled and editable.
- Pay button label carries the total: `Pay £45.00 — test, no money moves`.
- ~1s `Processing…` state, then the pay section is replaced by the confirmation:
  - Order number (`LOOP-1001`, incrementing per order in the session)
  - Item lines, discount applied, `Total paid £45.00`
  - The line `No money moved — this is a test payment`
  - `Start new order` (resets to an empty cart) and `View run` (scrolls to the Console)
- **Double-click / retry guard is the seeded bug's territory — see §5.** In correct behaviour, a second click on Pay while processing, or a retry after a confirmation, must NOT create a second charge.

### 3.4 Order ledger (persistent money — Wave 2 judges' fix)
Below the confirmation (same left column, or a clearly labelled section a judge can see without navigating):
- Every completed order is appended to a visible ledger: order ID, items, total, discount applied, confirmation state.
- Stock is decremented per order (each product starts with a visible stock count, e.g. Mug 10, Hoodie 10, Notebook 10; the ledger/stock display shows the count falling).
- **A wrong total must propagate to confirmation, receipt, and ledger — not just a page label.** Before/after screenshots must show the same wrong number in cart, confirmation, and ledger. That is what makes a money error a money error rather than a label error.

## 4. Primary flow (the Kane core flow — 4 clicks, 4 assertions)

The flow Kane runs, and the flow a human judge can do in <30s:

1. **Add Loop Mug** → cart shows 1× Mug, subtotal £15.00.
2. **Add Debug Hoodie** → subtotal £50.00.
3. **Apply KANE10** → discount −£5.00, total £45.00.
4. **Pay** → confirmation shows `Total paid £45.00` and an order number (`LOOP-1001`).

**Named assertions that end the flow (each Kane objective ends in one of these — see `02`):**
- **A1 — Subtotal:** after Mug + Hoodie, the cart subtotal is £50.00.
- **A2 — Discount:** after applying KANE10, the discount is −£5.00 and the total is £45.00.
- **A3 — Confirmation total:** after Pay, the confirmation shows `Total paid £45.00`.
- **A4 — Single charge:** after Pay, the ledger contains exactly ONE order for this checkout, the stock for Mug and Hoodie has each decremented by exactly 1, and no second confirmation exists.
- **A5 — Order identity (ledger):** the ledger row for the order shows the same items, discount, and total as the confirmation.

A run with no verify/assert gets no replayable pass/fail (AGENTS.md) — every objective in `02` ends in an assertion about what is on screen, never in a click.

## 5. Seeded regression (exactly ONE seeded bug — Wave 2 change)

**Seeded bug (changed from Wave 1 on researchers' evidence): double-charge on double-click Pay / retry.**

- **Behaviour:** if Pay is clicked twice in quick succession (or the payment is retried after the first charge has been taken), the order is charged twice: the ledger shows TWO orders for the same checkout, stock for Mug and Hoodie decrements by 2 each, and a second confirmation is issued. The cart total itself stays correct (£45.00) — the failure is in the *consequence* of paying, not in the arithmetic.
- **Why this bug, not Wave 1's double-discount (£40.00):** TestMu's own 3 Nov 2026 Codex review already demoed a discount/quote-total bug in that shape ("Cold brew 1L, 10 units, Total: $40.50, 10% off"). Seeding the same shape invites a "vendor's own example" discount. Double-charge is a different money failure, is not the vendor's example, and is only detectable through the persistent ledger — which is exactly why the ledger exists.
- **Why only one seeded bug:** a second seeded variant would make `Break it` non-deterministic. `Reset` restores correct behaviour. `Break it` (see `04`) must produce the *same failure signature every time*.
- **Disclosure:** the seeded bug is disclosed as seeded in the README and in the video (one line). It is staged evidence; the build must also keep **at least one genuine bug found during the build** (any real defect Kane catches that was not seeded), with its own red/green evidence, so Verified does not rest on staged evidence alone.
- **What the seeded bug breaks:** assertions A4 and A5 (single charge; ledger/confirmation agreement). A1–A3 still pass — which is the point: the checkout *looks* done (correct total on screen) while the money is wrong underneath. "It looks done. It isn't — and nobody checked."

**Other failure modes the chaos sweep must cover (see `02`, objective S1):** quantity 0 / negative quantity, discount code reuse (apply KANE10 twice — must not double-apply), refresh mid-pay, double-click Pay. These are *sweep probes*, not seeded bugs — the app must handle them correctly in the green state, and the sweep must fail if it does not.

## 6. Seeded state & determinism

- Fresh load: empty cart, prices/code as above, stock Mug 10 / Hoodie 10 / Notebook 10, order numbers sequential from `LOOP-1001`, no random values, no timestamps inside totals.
- No network calls to third-party services for the checkout itself. No login, no paid service, no external dependency — so no working credentials need to be handed to judges.
- The app must work identically on the canonical deployed URL (Kane target for final verification) and on a local preview server (loop target per fix — see `03` §9). Any divergence between the two is a build-blocking bug.

## 7. Acceptance criteria — what a judge can check in <30s

From the README's 30-second judge path (live URL → `Break it` → FAIL → fix → PASS):
1. Open the live URL: the checkout loads, three products with prices are visible, cart is empty with the stated text.
2. Click `Demo: add Mug + Hoodie`, apply KANE10, click Pay: confirmation shows `Total paid £45.00`, order `LOOP-1001`, ledger shows exactly one order, stock Mug 9 / Hoodie 9.
3. Click `Break it`: the Loop Console strip goes to FAIL (exit 1), the latest-run card shows the failing step, Kane's screenshot, and the fix — all without scrolling or clicking anything else.
4. After the loop fixes it: the same flow shows `Total paid £45.00`, exactly one ledger order, stock decremented by exactly 1 each.
5. Replay the suite from the README in <30s (`testmd run` of the committed `_test.md` files) and see fail-then-green without running the video.

**Freeze rule:** this spec is frozen on 12 Nov evening. Any change after 13 Nov needs a recorded reason in the run journal, and the Kane objectives in `02` must be updated to match — a spec change that is not reflected in the objectives is a test bug, not a fix.

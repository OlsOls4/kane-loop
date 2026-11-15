# buggy-loopmart/ — frozen pre-fix LoopMart (seeded double-charge bug)

Byte-identical copies of `loopmart/cart.js` and `loopmart/app.js` as they
were on 15 Nov 2026 **before** the double-charge fix landed (fixer
strategy `double-charge-idempotency-guard`, live Kane O2, result_code 740).

## Why this fixture exists

The fixer, sweep, loop and hardening tests all need a genuinely buggy
working copy to exercise the loop: they dispatch the fix on it and assert
it closes fail → patch → green. They used to seed that copy from the
live `loopmart/` files — but once the fix shipped, the live files are
patched, so the fixer's anchors no longer match and the sweep's
double-click probe passes on the "unpatched" copy. Seeding from the live
files after the fix would make those tests fail for the wrong reason (or
worse, silently test nothing).

So the buggy code is frozen here. The tests that need an unpatched copy
seed from this fixture; the tests that verify the shipped app (`loopmart/
test-cart.cjs`, `loopmart/test-app.cjs`) run against the live files.

## Rules

- Do NOT edit these files by hand. They are the pre-fix originals.
- If the seeded bug is ever reintroduced, or the fixer's anchors change,
  update this fixture and the anchor tests together — a fixture that no
  longer matches the fixer's anchors fails loudly (anchor not found).
- The fix itself lives in the live `loopmart/cart.js` and `loopmart/app.js`
  (idempotency guard in `pay()`, single-flight in `onPayClick()`, Pay
  button disabled while processing, both modes).

'use strict';
/**
 * LoopMart logic tests — docs/loopmart-spec.md §2–§5.
 * No browser: the pure cart.js logic is exercised directly.
 * Run: `node loopmart/test-cart.cjs` (exit 0 = all pass).
 */
const assert = require('node:assert/strict');
const LM = require('./cart.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('ok  ' + name);
  passed += 1;
}

function coreCart(mode) {
  const s = LM.freshState(mode);
  LM.addToCart(s, 'mug', 1);
  LM.addToCart(s, 'hoodie', 1);
  return s;
}

// Spec §2 — core-flow arithmetic.
check('core flow: Mug + Hoodie = £50 subtotal, KANE10 = −£5, total £45', () => {
  const s = coreCart('fixed');
  assert.equal(LM.subtotalPence(s), 5000);
  const r = LM.applyDiscount(s, 'KANE10');
  assert.equal(r.ok, true);
  assert.equal(LM.discountPence(s), 500);
  assert.equal(LM.totalPence(s), 4500);
  assert.equal(LM.money(LM.totalPence(s)), '£45.00');
});

check('discount applies once: second KANE10 is refused, total stays £45', () => {
  const s = coreCart('fixed');
  LM.applyDiscount(s, 'KANE10');
  const r = LM.applyDiscount(s, 'KANE10');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already-applied');
  assert.equal(LM.totalPence(s), 4500);
});

check('wrong discount code is refused, total unchanged', () => {
  const s = coreCart('fixed');
  const r = LM.applyDiscount(s, 'WRONG');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-recognised');
  assert.equal(LM.totalPence(s), 5000);
});

check('other judge-checkable totals: all three = £54, Mug alone = £15', () => {
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'mug', 1);
  LM.addToCart(s, 'hoodie', 1);
  LM.addToCart(s, 'notebook', 1);
  LM.applyDiscount(s, 'KANE10');
  assert.equal(LM.subtotalPence(s), 6000);
  assert.equal(LM.totalPence(s), 5400);
  const m = LM.freshState('fixed');
  LM.addToCart(m, 'mug', 1);
  assert.equal(LM.totalPence(m), 1500);
});

// Spec §5 — seeded bug: double-charge on double-click Pay.
check('fixed mode: one Pay = one order, stock −1 each, A1–A5 all pass', () => {
  const s = coreCart('fixed');
  LM.applyDiscount(s, 'KANE10');
  const exp = LM.snapshotCheckout(s);
  const r = LM.pay(s);
  assert.equal(r.charged, true);
  assert.equal(s.orders.length, 1);
  assert.equal(s.orders[0].id, 'LOOP-1001');
  assert.equal(s.stock.mug, 9);
  assert.equal(s.stock.hoodie, 9);
  assert.equal(s.confirmation.id, 'LOOP-1001');
  const a = LM.assertions(s, exp);
  assert.deepEqual(a, { A1: true, A2: true, A3: true, A4: true, A5: true });
});

check('REGRESSION (live Kane O2, 15 Nov): buggy mode double-click Pay = 1 order, stock −1 each, A1–A5 pass', () => {
  const s = coreCart('buggy');
  LM.applyDiscount(s, 'KANE10');
  const exp = LM.snapshotCheckout(s);
  const first = LM.pay(s); // first click charges once
  assert.equal(first.charged, true);
  const second = LM.pay(s); // double-click while processing: idempotency guard holds
  assert.equal(second.charged, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.order.id, 'LOOP-1001');
  assert.equal(s.orders.length, 1);
  assert.deepEqual(s.orders.map((o) => o.id), ['LOOP-1001']);
  assert.equal(s.stock.mug, 9);
  assert.equal(s.stock.hoodie, 9);
  assert.equal(s.confirmation.id, 'LOOP-1001');
  assert.equal(LM.totalPence(s), 4500);
  const a = LM.assertions(s, exp);
  assert.deepEqual(a, { A1: true, A2: true, A3: true, A4: true, A5: true });
});

check('buggy mode: retry after a confirmation is ignored (idempotency guard)', () => {
  const s = coreCart('buggy');
  LM.applyDiscount(s, 'KANE10');
  LM.pay(s);
  const r = LM.pay(s);
  assert.equal(r.charged, false);
  assert.equal(r.duplicate, true);
  assert.equal(s.orders.length, 1);
  assert.equal(s.stock.mug, 9);
});

check('fixed mode: double-click and retry are ignored, still one order', () => {
  const s = coreCart('fixed');
  LM.applyDiscount(s, 'KANE10');
  LM.pay(s);
  const second = LM.pay(s);
  assert.equal(second.charged, false);
  const retry = LM.pay(s);
  assert.equal(retry.charged, false);
  assert.equal(s.orders.length, 1);
  assert.equal(s.stock.mug, 9);
});

check('reset restores seeded state (empty cart, stock 10) but order numbers keep incrementing', () => {
  const s = coreCart('buggy');
  LM.pay(s);
  LM.reset(s);
  assert.equal(s.orders.length, 0);
  assert.equal(s.confirmation, null);
  assert.equal(s.stock.mug, 10);
  assert.equal(s.nextOrderNo, 1002, 'order numbers never repeat within a session');
  assert.equal(LM.totalPence(s), 0);
});

check('quantity 0 removes the line (chaos-sweep probe)', () => {
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'notebook', 2);
  LM.addToCart(s, 'mug', 1);
  LM.setQuantity(s, 'mug', 0);
  assert.deepEqual(LM.cartLines(s).map((l) => l.id), ['notebook']);
  assert.equal(LM.subtotalPence(s), 2000);
  LM.setQuantity(s, 'notebook', -3);
  assert.equal(LM.cartLines(s).length, 0);
});

check('chaos-sweep math: 2 notebooks + 1 mug = £35 − £3.50 = £31.50; mug to 0 = £18', () => {
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'notebook', 2);
  LM.addToCart(s, 'mug', 1);
  LM.applyDiscount(s, 'KANE10');
  assert.equal(LM.subtotalPence(s), 3500);
  assert.equal(LM.discountPence(s), 350);
  assert.equal(LM.totalPence(s), 3150);
  LM.setQuantity(s, 'mug', 0);
  assert.equal(LM.subtotalPence(s), 2000);
  assert.equal(LM.discountPence(s), 200);
  assert.equal(LM.totalPence(s), 1800);
});

check('mode switch: buggy -> fixed stops the double charge', () => {
  const s = coreCart('buggy');
  LM.setMode(s, 'fixed');
  LM.pay(s);
  assert.equal(LM.pay(s).charged, false);
  assert.equal(s.orders.length, 1);
});

// Principal-engineer hardening, 15 Nov 2026 — cart.js guards.
check('pay on an empty cart charges nothing and creates no £0 order', () => {
  const s = LM.freshState('fixed');
  const r = LM.pay(s);
  assert.equal(r.charged, false);
  assert.equal(r.reason, 'empty-cart');
  assert.equal(s.orders.length, 0);
  assert.equal(s.confirmation, null);
  assert.equal(s.stock.mug, 10);
});

check('quantity is clamped to stock: no more than 10 of any product', () => {
  const s = LM.freshState('fixed');
  assert.equal(LM.addToCart(s, 'mug', 99), true);
  assert.equal(s.cart.mug, 10);
  LM.setQuantity(s, 'hoodie', 42);
  assert.equal(s.cart.hoodie, 10);
  assert.equal(LM.subtotalPence(s), 50000);
});

check('non-finite quantity leaves the state alone (NaN/Infinity do not corrupt totals)', () => {
  const s = LM.freshState('fixed');
  LM.addToCart(s, 'mug', 1);
  assert.equal(LM.addToCart(s, 'hoodie', NaN), false);
  assert.equal(LM.setQuantity(s, 'mug', NaN), false);
  assert.equal(LM.setQuantity(s, 'mug', Infinity), false);
  assert.equal(LM.addToCart(s, 'mug', '2'), false);
  assert.deepEqual(LM.cartLines(s).map((l) => [l.id, l.qty]), [['mug', 1]]);
  assert.equal(LM.totalPence(s), 1500);
});

check('discount is frozen after the first charge', () => {
  const s = coreCart('fixed');
  LM.pay(s);
  const r = LM.applyDiscount(s, 'KANE10');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already-charged');
  assert.equal(s.confirmation.discountPence, 0);
});

console.log(passed + ' LoopMart logic tests passed');

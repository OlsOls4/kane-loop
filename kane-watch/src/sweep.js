'use strict';
/**
 * Kane Loop — independent chaos / defect sweep (prep 02, objective O2).
 *
 * The sweep is the genuinely independent second check: it runs different
 * inputs from the core flow (different products, quantities, discount),
 * and it DERIVES the expected total itself from the catalogue prices —
 * never from the app's displayed total and never from the core flow's
 * assertions. A hard-coded total or a deleted discount branch fails it
 * even if it passes the replay.
 *
 * Independence (15 Nov correction): the expected prices are HARDCODED
 * here from the frozen spec (docs/loopmart-spec.md §2 / README price
 * table: Mug £15, Hoodie £35, Notebook £10) — they are NOT read from
 * LM.PRODUCTS, the same catalogue constant the app itself uses. The
 * earlier version derived them from LM.PRODUCTS, so a tampered price
 * table made the sweep and the app agree and the probe passed. The
 * hardcoded spec prices are the thing under test, not a copy of the
 * app's answer: if the app's price table is tampered, this probe fails.
 *
 * This module executes the sweep deterministically against LoopMart's
 * pure logic (cart.js), so it runs with no live Kane CLI and no credits.
 * The live sweep is the same probes as a `kane run` of the O2 objective
 * (tests/objectives/loopmart-chaos-sweep.objective.md). Probe results
 * are labelled by how they were produced; nothing here claims a live run.
 *
 * Probes 1–6 are the gate's independent check. Probe 7 is the disclosed
 * genuine defect G1 (Start new order wipes the ledger): it FAILS by
 * design and is reported separately, excluded from the pass.
 */
const path = require('node:path');

const SWEEP_INPUTS = '2x notebook + 1x mug, KANE10; qty 0; double-click Pay';

// Expected catalogue prices, HARDCODED from the frozen spec
// (docs/loopmart-spec.md §2; README price table) — never read from
// LM.PRODUCTS, which is the same constant the app uses. A tampered
// price table must make this probe fail, not agree with the app.
const EXPECTED_PRICES_PENCE = { mug: 1500, hoodie: 3500, notebook: 1000 };

function loadCart(cartPath) {
  const resolved = require.resolve(cartPath);
  delete require.cache[resolved];
  return require(resolved);
}

function runSweep(cartPath) {
  const LM = loadCart(cartPath || path.join(__dirname, '..', '..', 'loopmart', 'cart.js'));
  const probes = [];

  function probe(id, name, fn) {
    try {
      const r = fn();
      probes.push({ id: id, name: name, expected: r.expected, actual: r.actual, pass: r.pass, note: r.note || null });
    } catch (e) {
      probes.push({ id: id, name: name, expected: null, actual: 'threw: ' + e.message, pass: false, note: null });
    }
  }

  // P1 — independent total. Expected values are derived here from the
  // HARDCODED spec prices (see EXPECTED_PRICES_PENCE above), not from
  // LM.PRODUCTS and not copied from the app or the core flow.
  probe('independent-total', '2 notebooks + 1 mug, KANE10: total derived from spec prices', () => {
    const sub = 2 * EXPECTED_PRICES_PENCE.notebook + 1 * EXPECTED_PRICES_PENCE.mug; // 2x1000 + 1500 = 3500
    const disc = Math.round((sub * 10) / 100); // 350
    const total = sub - disc; // 3150
    const s = LM.freshState('fixed');
    LM.addToCart(s, 'notebook', 2);
    LM.addToCart(s, 'mug', 1);
    LM.applyDiscount(s, 'KANE10');
    return {
      expected: 'subtotal £' + (sub / 100).toFixed(2) + ', discount −£' + (disc / 100).toFixed(2) + ', total £' + (total / 100).toFixed(2),
      actual: 'subtotal ' + LM.money(LM.subtotalPence(s)) + ', discount ' + LM.money(LM.discountPence(s)) + ', total ' + LM.money(LM.totalPence(s)),
      pass: LM.subtotalPence(s) === sub && LM.discountPence(s) === disc && LM.totalPence(s) === total,
    };
  });

  // P2 — quantity 0 removes the line and re-derives the total.
  probe('quantity-zero', 'Loop Mug quantity set to 0: only notebooks remain, total re-derived', () => {
    const s = LM.freshState('fixed');
    LM.addToCart(s, 'notebook', 2);
    LM.addToCart(s, 'mug', 1);
    LM.applyDiscount(s, 'KANE10');
    LM.setQuantity(s, 'mug', 0);
    return {
      expected: '1 line (2 notebooks), subtotal £20.00, total £18.00',
      actual: LM.cartLines(s).length + ' line(s), subtotal ' + LM.money(LM.subtotalPence(s)) + ', total ' + LM.money(LM.totalPence(s)),
      pass: LM.cartLines(s).length === 1 && LM.subtotalPence(s) === 2000 && LM.totalPence(s) === 1800,
    };
  });

  // P3 — double-click Pay: exactly one order, notebook stock −2, no other stock changed.
  probe('double-click-pay', 'double-click Pay: exactly 1 order, notebook stock −2, others unchanged', () => {
    const s = LM.freshState('buggy'); // sweep runs against the app as-is; the bug must fail it
    LM.addToCart(s, 'notebook', 2);
    LM.addToCart(s, 'mug', 1);
    LM.applyDiscount(s, 'KANE10');
    LM.pay(s);
    LM.pay(s);
    return {
      expected: '1 order; stock notebook 8, mug 9, hoodie 10',
      actual: s.orders.length + ' order(s); stock notebook ' + s.stock.notebook + ', mug ' + s.stock.mug + ', hoodie ' + s.stock.hoodie,
      pass: s.orders.length === 1 && s.stock.notebook === 8 && s.stock.mug === 9 && s.stock.hoodie === 10,
    };
  });

  // P4 — negative quantity removes the line.
  probe('negative-quantity', 'negative quantity removes the line (no negative totals)', () => {
    const s = LM.freshState('fixed');
    LM.addToCart(s, 'notebook', 2);
    LM.setQuantity(s, 'notebook', -5);
    return {
      expected: 'cart empty, total £0.00',
      actual: 'cart lines ' + LM.cartLines(s).length + ', total ' + LM.money(LM.totalPence(s)),
      pass: LM.cartLines(s).length === 0 && LM.totalPence(s) === 0,
    };
  });

  // P5 — discount reuse: KANE10 twice applies once.
  probe('discount-reuse', 'KANE10 applied twice: discount applies once', () => {
    const s = LM.freshState('fixed');
    LM.addToCart(s, 'mug', 1);
    LM.addToCart(s, 'hoodie', 1);
    LM.applyDiscount(s, 'KANE10');
    const second = LM.applyDiscount(s, 'KANE10');
    return {
      expected: 'second apply refused, total £45.00',
      actual: 'second apply ok=' + second.ok + ' (' + second.reason + '), total ' + LM.money(LM.totalPence(s)),
      pass: second.ok === false && LM.totalPence(s) === 4500,
    };
  });

  // P6 — refresh mid-pay (local state-level check only): a fresh load has
  // no phantom order. Browser refresh timing needs a live Kane run.
  probe('refresh-mid-pay', 'fresh load after a payment started: no phantom order', () => {
    const before = LM.freshState('fixed');
    LM.addToCart(before, 'mug', 1);
    LM.pay(before);
    const after = LM.freshState('fixed'); // a refresh reloads the page state
    return {
      expected: 'fresh load: 0 orders, no confirmation',
      actual: after.orders.length + ' order(s), confirmation ' + (after.confirmation ? 'present' : 'absent'),
      pass: after.orders.length === 0 && after.confirmation === null,
      note: 'Local state-level check only; browser refresh timing needs a live Kane run.',
    };
  });

  // P7 — KNOWN ISSUE G1 (genuine defect, retained and disclosed): two
  // sequential checkouts in one session should both stay in the ledger
  // (spec §3.4), but Start new order wipes it. FAILS by design; excluded
  // from the gate's pass and reported separately.
  probe('ledger-persists-across-orders', 'G1 known issue: second checkout, ledger still shows both orders', () => {
    const s = LM.freshState('fixed');
    LM.addToCart(s, 'mug', 1);
    LM.pay(s);
    LM.reset(s); // Start new order
    LM.addToCart(s, 'hoodie', 1);
    LM.pay(s);
    return {
      expected: '2 orders in the ledger (LOOP-1001, LOOP-1002)',
      actual: s.orders.length + ' order(s) in the ledger (' + s.orders.map((o) => o.id).join(', ') + ')',
      pass: s.orders.length === 2,
      note: 'GENUINE DEFECT G1 (retained, disclosed): Start new order wipes the ledger.',
    };
  });

  const core = probes.filter((p) => p.id !== 'ledger-persists-across-orders');
  const knownIssue = probes.find((p) => p.id === 'ledger-persists-across-orders');
  return {
    pass: core.every((p) => p.pass),
    probes: probes,
    knownIssue: knownIssue,
    inputs: SWEEP_INPUTS,
  };
}

module.exports = { runSweep: runSweep, SWEEP_INPUTS: SWEEP_INPUTS, EXPECTED_PRICES_PENCE: EXPECTED_PRICES_PENCE };

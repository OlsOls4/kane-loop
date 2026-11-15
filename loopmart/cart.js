/* LoopMart — checkout logic (pure, no DOM).
 *
 * Spec: docs/loopmart-spec.md (frozen 12 Nov). Money is integer pence.
 * Products: Loop Mug £15, Debug Hoodie £35, Kane Notebook £10.
 * Discount: KANE10 = 10% off, applies once, never double-applies.
 * Seeded bug (disclosed as seeded): mode 'buggy' — a second Pay while
 * processing, or a retry after a confirmation, charges the order a second
 * time: a second ledger order, stock decremented twice, a second
 * confirmation. Mode 'fixed' — the idempotency guard holds: one charge
 * per checkout, however many times Pay is clicked.
 * The cart total itself stays correct in both modes (£45.00 for the core
 * flow): the failure is in the consequence of paying, not the arithmetic.
 * Assertions A1–A5 (spec §4) are computed by assertions() so the harness
 * and the page can check the same thing Kane checks.
 *
 * UMD: works as a browser global (window.LoopMart) and under Node
 * (module.exports), so the same logic is unit-tested without a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoopMart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRODUCTS = [
    { id: 'mug', name: 'Loop Mug', pricePence: 1500, stock: 10 },
    { id: 'hoodie', name: 'Debug Hoodie', pricePence: 3500, stock: 10 },
    { id: 'notebook', name: 'Kane Notebook', pricePence: 1000, stock: 10 },
  ];
  const DISCOUNT_CODE = 'KANE10';
  const DISCOUNT_PERCENT = 10;

  function money(pence) {
    return '£' + (pence / 100).toFixed(2);
  }

  function freshState(mode) {
    return {
      mode: mode === 'fixed' ? 'fixed' : 'buggy',
      cart: { mug: 0, hoodie: 0, notebook: 0 },
      discountApplied: false,
      discountCode: null,
      processing: false,
      // Last confirmed order of the current checkout (null until a pay).
      confirmation: null,
      // Visible ledger: every completed order, in order.
      orders: [],
      stock: { mug: 10, hoodie: 10, notebook: 10 },
      nextOrderNo: 1001,
      // How many times Pay was invoked for the current checkout.
      payAttempts: 0,
      // Charges queued while a payment is in flight (DOM layer only).
      pendingCharges: 0,
    };
  }

  function productById(id) {
    return PRODUCTS.find(function (p) { return p.id === id; });
  }

  // Quantity guard (principal-engineer hardening, 15 Nov): qty must be a
  // finite integer; NaN / Infinity / non-numbers leave the state alone
  // instead of corrupting it (NaN used to poison the cart total).
  function validQty(qty) {
    return typeof qty === 'number' && Number.isFinite(qty) ? Math.floor(qty) : null;
  }

  function addToCart(state, id, qty) {
    const p = productById(id);
    if (!p) return false;
    const n = qty === undefined ? 1 : validQty(qty);
    if (n === null) return false;
    // Clamp to current stock: the cart can never hold more than is in stock.
    state.cart[id] = Math.min(state.stock[id], Math.max(0, state.cart[id] + n));
    return true;
  }

  function setQuantity(state, id, qty) {
    const p = productById(id);
    if (!p) return false;
    const n = validQty(qty);
    if (n === null) return false;
    // Quantity 0 / negative removes the line (chaos-sweep probe, spec §5).
    state.cart[id] = Math.min(state.stock[id], Math.max(0, n));
    return true;
  }

  function cartLines(state) {
    return PRODUCTS.filter(function (p) { return state.cart[p.id] > 0; })
      .map(function (p) {
        return {
          id: p.id, name: p.name, pricePence: p.pricePence,
          qty: state.cart[p.id], linePence: p.pricePence * state.cart[p.id],
        };
      });
  }

  function subtotalPence(state) {
    return cartLines(state).reduce(function (s, l) { return s + l.linePence; }, 0);
  }

  function discountPence(state) {
    if (!state.discountApplied) return 0;
    return Math.round((subtotalPence(state) * DISCOUNT_PERCENT) / 100);
  }

  function totalPence(state) {
    return subtotalPence(state) - discountPence(state);
  }

  function applyDiscount(state, code) {
    if (state.confirmation) return { ok: false, reason: 'already-charged' };
    if (state.discountApplied) return { ok: false, reason: 'already-applied' };
    if (code !== DISCOUNT_CODE) return { ok: false, reason: 'not-recognised' };
    state.discountApplied = true;
    state.discountCode = code;
    return { ok: true };
  }

  function snapshotCheckout(state) {
    return {
      items: cartLines(state),
      subtotalPence: subtotalPence(state),
      discountPence: discountPence(state),
      discountCode: state.discountCode,
      totalPence: totalPence(state),
    };
  }

  // Charge the current checkout once: append a ledger order, decrement
  // stock, issue a confirmation. Returns the order.
  function chargeOnce(state) {
    const snap = snapshotCheckout(state);
    const orderNo = 'LOOP-' + state.nextOrderNo;
    state.nextOrderNo += 1;
    snap.items.forEach(function (l) { state.stock[l.id] -= l.qty; });
    const order = {
      id: orderNo,
      items: snap.items,
      subtotalPence: snap.subtotalPence,
      discountPence: snap.discountPence,
      discountCode: snap.discountCode,
      totalPence: snap.totalPence,
      state: 'confirmed',
    };
    state.orders.push(order);
    state.confirmation = order;
    return order;
  }

  /**
   * Pay for the current checkout. One call = one charge request.
   * - Paying an empty cart charges nothing and creates no order (a £0
   *   order used to be created — principal-engineer hardening, 15 Nov).
   * - First pay: charges once (both modes).
   * - A further pay after a confirmation exists (double-click while the
   *   first payment is in flight, or a retry after confirmation):
   *   buggy mode charges AGAIN (the seeded double-charge); fixed mode
   *   returns the existing confirmation and charges nothing.
   * The page calls pay() once per charge at the end of the ~1s
   * "Processing…" state; the charge and the confirmation land together,
   * so the ledger and the confirmation never disagree mid-flight.
   */
  function pay(state) {
    state.payAttempts += 1;
    if (cartLines(state).length === 0) {
      return { charged: false, order: null, duplicate: false, reason: 'empty-cart' };
    }
    if (state.confirmation) {
      // Idempotency guard: one charge per checkout, however many times
      // Pay is clicked. Fixes the double-charge on double-click Pay.
      return { charged: false, order: state.confirmation, duplicate: true };
    }
    return { charged: true, order: chargeOnce(state), duplicate: false };
  }

  function reset(state) {
    // Fresh seeded state, but order numbers keep incrementing within the
    // session: two different orders must never share an order number,
    // even across a "Start new order" reset.
    const mode = state.mode;
    const nextOrderNo = state.nextOrderNo;
    const fresh = freshState(mode);
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    state.nextOrderNo = nextOrderNo;
  }

  function setMode(state, mode) {
    state.mode = mode === 'fixed' ? 'fixed' : 'buggy';
  }

  // Named assertions A1–A5 (spec §4) for the core flow, evaluated against
  // the current state. `expected` is the checkout the assertions are about
  // (defaults to the current cart snapshot).
  function assertions(state, expected) {
    const exp = expected || snapshotCheckout(state);
    const sub = subtotalPence(state);
    const disc = discountPence(state);
    const tot = totalPence(state);
    const a1 = sub === exp.subtotalPence;
    const a2 = disc === exp.discountPence && tot === exp.totalPence;
    const conf = state.confirmation;
    const a3 = !!conf && conf.totalPence === exp.totalPence;
    // A4: exactly one ledger order for this checkout, stock decremented
    // by exactly the ordered quantities, no second confirmation.
    const ordersForCheckout = state.orders.filter(function (o) {
      return o.totalPence === exp.totalPence
        && o.items.length === exp.items.length
        && o.items.every(function (it, i) {
          return exp.items[i] && it.id === exp.items[i].id && it.qty === exp.items[i].qty;
        });
    });
    let stockOk = true;
    exp.items.forEach(function (it) {
      const expectedStock = 10 - it.qty;
      if (state.stock[it.id] !== expectedStock) stockOk = false;
    });
    const a4 = !!conf && ordersForCheckout.length === 1 && stockOk;
    // A5: exactly one ledger row for this checkout, and it agrees with
    // the confirmation (same items, discount, total). With a double
    // charge there are two rows for one checkout, so there is no single
    // row that is "the" order — A5 fails, as the spec requires.
    const a5 = !!conf && ordersForCheckout.length === 1
      && ordersForCheckout[0].id === conf.id
      && ordersForCheckout[0].discountPence === conf.discountPence
      && ordersForCheckout[0].totalPence === conf.totalPence;
    return { A1: a1, A2: a2, A3: a3, A4: a4, A5: a5 };
  }

  return {
    PRODUCTS: PRODUCTS,
    DISCOUNT_CODE: DISCOUNT_CODE,
    money: money,
    freshState: freshState,
    addToCart: addToCart,
    setQuantity: setQuantity,
    cartLines: cartLines,
    subtotalPence: subtotalPence,
    discountPence: discountPence,
    totalPence: totalPence,
    applyDiscount: applyDiscount,
    snapshotCheckout: snapshotCheckout,
    pay: pay,
    reset: reset,
    setMode: setMode,
    assertions: assertions,
  };
});

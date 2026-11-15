/* LoopMart — DOM wiring for index.html.
 *
 * Spec: docs/loopmart-spec.md. All money/state logic lives in cart.js;
 * this file only renders state and forwards clicks. `initLoopMart(doc,
 * opts)` takes the document so tests can drive it with a fake document
 * (no browser needed for the wiring tests).
 *
 * Processing timing (UI/UX hardening, 15 Nov): the charge lands when
 * the ~1s "Processing…" state ENDS, so the ledger and the confirmation
 * never disagree mid-flight. The seeded double-charge: the Pay button
 * stays clickable while Processing runs in buggy mode, so a second click
 * queues a second charge that lands with the first. In fixed mode the
 * button is disabled while processing and a second click is ignored.
 * A retry after a confirmation is unreachable in a real browser (the pay
 * section is hidden once a confirmation shows) and is ignored by the
 * handler. The canonical trigger is double-click during Processing.
 *
 * Genuine defect G1 (retained, disclosed — see README Known issues):
 * "Start new order" wipes the ledger, so completed orders are lost.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.initLoopMart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getModeFromQuery(search) {
    const m = /[?&]mode=(buggy|fixed)/.exec(search || '');
    return m ? m[1] : 'buggy'; // Day 2 build ships with the seeded bug armed.
  }

  function initLoopMart(doc, opts) {
    const LM = (typeof window !== 'undefined' && window.LoopMart)
      || (typeof require === 'function' ? require('./cart.js') : null);
    const options = opts || {};
    // Default timers are BOUND to the global object: in a real browser
    // window.setTimeout requires `this === window` and throws
    // "TypeError: Illegal invocation" when called detached. app.js used
    // to store the bare global and call it as timers.setTimeout(...),
    // which broke Pay entirely in Chrome (1s timer never fired, no
    // charge ever landed — caught by live Kane run O1, 15 Nov,
    // result_code 740). globalThis IS window in a browser, so binding
    // to it is correct there and harmless in Node. Injected
    // options.timers (tests) are used exactly as supplied.
    const timers = options.timers || {
      setTimeout: setTimeout.bind(globalThis),
      clearTimeout: clearTimeout.bind(globalThis),
    };
    const search = options.search !== undefined
      ? options.search
      : (typeof location !== 'undefined' ? location.search : '');
    const state = LM.freshState(getModeFromQuery(search));

    const el = function (id) { return doc.getElementById(id); };
    const money = LM.money;

    function stepper(container, product, qty, delta) {
      const btn = doc.createElement('button');
      btn.textContent = delta > 0 ? '+' : '\u2212';
      btn.setAttribute('aria-label', (delta > 0 ? 'Increase ' : 'Decrease ')
        + product.name + ' quantity');
      btn.onclick = function () { LM.setQuantity(state, product.id, qty + delta); render(); };
      container.appendChild(btn);
      return btn;
    }

    function renderProducts() {
      const host = el('products');
      host.innerHTML = '';
      LM.PRODUCTS.forEach(function (p) {
        const card = doc.createElement('div');
        card.className = 'product';
        const qty = state.cart[p.id];
        card.innerHTML =
          '<strong>' + p.name + '</strong><br>' +
          '<span class="price">' + money(p.pricePence) + '</span><br>' +
          '<span class="muted">Stock: ' + state.stock[p.id] + '</span><br>';
        const btn = doc.createElement('button');
        btn.setAttribute('data-action', 'add');
        btn.setAttribute('data-id', p.id);
        btn.setAttribute('aria-label', 'Add ' + p.name + ' to cart');
        btn.textContent = qty > 0 ? 'Added \u2713 \u2014 ' + qty + ' in cart' : 'Add to cart';
        btn.onclick = function () { LM.addToCart(state, p.id, 1); render(); };
        card.appendChild(btn);
        if (qty > 0) {
          const step = doc.createElement('span');
          step.className = 'stepper';
          step.innerHTML = ' ';
          stepper(step, p, qty, -1);
          stepper(step, p, qty, 1);
          card.appendChild(step);
        }
        host.appendChild(card);
      });
    }

    function renderCart() {
      const lines = LM.cartLines(state);
      el('cart-empty').hidden = lines.length > 0;
      const host = el('cart-lines');
      host.innerHTML = '';
      lines.forEach(function (l) {
        const row = doc.createElement('p');
        row.textContent = l.qty + ' \u00d7 ' + l.name + ' — ' + money(l.linePence) + ' ';
        const product = LM.PRODUCTS.filter(function (p) { return p.id === l.id; })[0];
        stepper(row, product, l.qty, -1);
        stepper(row, product, l.qty, 1);
        host.appendChild(row);
      });
      el('subtotal').textContent = money(LM.subtotalPence(state));
      el('discount').textContent = state.discountApplied
        ? '\u2212' + money(LM.discountPence(state)) : money(0);
      el('total').textContent = money(LM.totalPence(state));
      const payBtn = el('pay-button');
      payBtn.textContent = state.processing
        ? 'Processing\u2026'
        : 'Pay ' + money(LM.totalPence(state)) + ' \u2014 test, no money moves';
      // In fixed mode the button is disabled while processing (no second
      // click possible); in buggy mode it stays enabled — that is the
      // seeded bug's window. Empty cart: Pay is disabled with the reason
      // in text, not a silent no-op.
      payBtn.disabled = (state.processing && state.mode === 'fixed')
        || lines.length === 0;
      el('pay-status').textContent = lines.length === 0
        ? 'Cart is empty — add a product first.'
        : '';
    }

    // Orders for the current checkout (same items + total as the
    // confirmation). More than one means the checkout was charged twice.
    function matchingOrders(conf) {
      return state.orders.filter(function (o) {
        return o.totalPence === conf.totalPence
          && o.items.length === conf.items.length
          && o.items.every(function (it, i) {
            return conf.items[i] && it.id === conf.items[i].id && it.qty === conf.items[i].qty;
          });
      });
    }

    function renderConfirmation() {
      const conf = state.confirmation;
      // The charge lands when Processing ends; until then neither the
      // confirmation nor the ledger shows the order.
      el('confirmation').hidden = !(conf && !state.processing);
      el('pay-section').hidden = !!(conf && !state.processing);
      if (!conf) return;
      el('conf-order').textContent = conf.id;
      const host = el('conf-lines');
      host.innerHTML = '';
      conf.items.forEach(function (it) {
        const p = doc.createElement('p');
        p.textContent = it.qty + ' \u00d7 ' + it.name + ' — ' + money(it.linePence);
        host.appendChild(p);
      });
      el('conf-total').textContent = 'Total paid ' + money(conf.totalPence)
        + (conf.discountPence > 0 ? ' (discount ' + money(conf.discountPence) + ' applied)' : '');
      // Double-charge anomaly flag (text, not colour-only): a hurried
      // judge must not miss two identical ledger rows behind a green
      // "Order confirmed" heading.
      const matches = matchingOrders(conf);
      const flag = el('charge-flag');
      flag.hidden = matches.length < 2;
      if (matches.length >= 2) {
        flag.textContent = '\u26a0 ' + matches.length + ' charges for one checkout — expected 1 ('
          + matches.map(function (o) { return o.id; }).join(', ') + ')';
      } else {
        flag.textContent = '';
      }
    }

    function renderLedger() {
      const body = el('ledger-body');
      body.innerHTML = '';
      if (state.orders.length === 0) {
        const tr = doc.createElement('tr');
        const td = doc.createElement('td');
        td.colSpan = 5;
        td.className = 'muted';
        td.textContent = 'No orders yet.';
        tr.appendChild(td);
        body.appendChild(tr);
      } else {
        state.orders.forEach(function (o) {
          const tr = doc.createElement('tr');
          const items = o.items.map(function (it) { return it.qty + ' \u00d7 ' + it.name; }).join(', ');
          const disc = o.discountPence > 0 ? '\u2212' + money(o.discountPence) + ' (' + o.discountCode + ')' : money(0);
          [o.id, items, disc, money(o.totalPence), o.state].forEach(function (v) {
            const td = doc.createElement('td');
            td.textContent = v;
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
      }
      const summary = el('ledger-summary');
      summary.textContent = state.orders.length === 0
        ? 'No orders yet.'
        : state.orders.length + (state.orders.length === 1 ? ' order, ' : ' orders, ')
          + 'total ' + money(state.orders.reduce(function (s, o) { return s + o.totalPence; }, 0));
    }

    // Stock is rendered on EVERY render (UI/UX bug, 15 Nov): it used to
    // sit after the early return in renderLedger, so a cold load showed
    // an empty stock list and "Start new order" showed stale counts.
    function renderStock() {
      const stock = el('stock-list');
      stock.innerHTML = '';
      LM.PRODUCTS.forEach(function (p) {
        const li = doc.createElement('li');
        li.textContent = p.name + ' — ' + state.stock[p.id] + ' in stock';
        stock.appendChild(li);
      });
    }

    function renderBugBox() {
      el('bug-status').textContent = state.mode === 'buggy'
        ? 'Seeded bug ARMED: double-charge on double-click Pay during Processing.'
        : 'Seeded bug OFF: one charge per checkout (correct behaviour).';
    }

    function render() {
      renderProducts();
      renderCart();
      renderConfirmation();
      renderLedger();
      renderStock();
      renderBugBox();
    }

    function onPayClick() {
      // The pay form is never read by the old code — Pay succeeded with
      // an empty card. Validate it (test values are pre-filled).
      if (!el('pay-name').value.trim() || !el('pay-card').value.trim()
        || !el('pay-expiry').value.trim() || !el('pay-cvc').value.trim()) {
        el('pay-status').textContent = 'Fill in name, card, expiry and CVC — test values are pre-filled.';
        return;
      }
      if (state.confirmation) {
        // Retry after a confirmation: unreachable in a real browser (the
        // pay section is hidden once a confirmation shows). Ignore it.
        return;
      }
      if (state.processing) {
        // Second click while the first payment is in flight.
        // Buggy mode: queue a second charge (the seeded double-charge).
        // Fixed mode: ignore.
        if (state.mode === 'buggy') state.pendingCharges += 1;
        render();
        return;
      }
      if (LM.cartLines(state).length === 0) {
        el('pay-status').textContent = 'Cart is empty — add a product first.';
        return;
      }
      // Charge at the END of the Processing state, not on the click: the
      // ledger row and the confirmation land together, so at no moment
      // does the ledger show an order the confirmation contradicts.
      state.processing = true;
      state.pendingCharges = 1;
      render();
      timers.setTimeout(function () {
        for (let i = 0; i < state.pendingCharges; i++) LM.pay(state);
        state.pendingCharges = 0;
        state.processing = false;
        render();
        const conf = el('confirmation');
        if (!conf.hidden && conf.focus) conf.focus();
      }, 1000);
    }

    el('pay-button').onclick = onPayClick;
    el('apply-discount').onclick = function () {
      const code = el('discount-code').value.trim();
      const r = LM.applyDiscount(state, code);
      const msg = el('discount-msg');
      if (r.ok) { msg.textContent = 'KANE10 applied — 10% off.'; msg.className = 'ok'; }
      else if (r.reason === 'already-applied') { msg.textContent = 'Code already applied — it does not apply twice.'; msg.className = ''; }
      else if (r.reason === 'already-charged') { msg.textContent = 'Discount is frozen — this checkout is already charged.'; msg.className = ''; }
      else { msg.textContent = 'Code not recognised — try KANE10'; msg.className = 'msg'; }
      render();
    };
    el('demo-add').onclick = function () {
      LM.addToCart(state, 'mug', 1);
      LM.addToCart(state, 'hoodie', 1);
      render();
    };
    el('new-order').onclick = function () { LM.reset(state); render(); };
    el('view-run').onclick = function () {
      const box = el('seeded-box');
      if (box && box.scrollIntoView) box.scrollIntoView();
    };
    el('break-it').onclick = function () {
      LM.setMode(state, 'buggy');
      LM.reset(state);
      render();
    };
    el('reset-bug').onclick = function () {
      LM.setMode(state, 'fixed');
      LM.reset(state);
      render();
    };

    render();
    return { state: state, render: render, LM: LM };
  }

  return initLoopMart;
});

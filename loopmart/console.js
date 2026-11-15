/* Loop Console — drives the one-screen console (loopmart/console.html).
 *
 * The console shows the LoopMart checkout (left, in an iframe) and the
 * loop state (right). Run data comes from console-data-live.json (the
 * real 15 Nov 2026 live Kane runs — latest first, with test_url links
 * and measured credits), falling back to console-data.json, which the
 * dry-run loop regenerates as EXAMPLE data (`npm test` rewrites it —
 * that is by design, and a test pins it; never put live data there).
 * Nothing here presents synthetic output as a live Kane run: the replay
 * leg is unproven (3 Kane-side analyzer failures) and the console says so.
 *
 * Break it (console header): arms the seeded bug in the checkout, fills
 * Mug + Hoodie + KANE10, double-clicks Pay, and reproduces the scenario
 * LOCALLY (no Kane run starts from this button). With the fix shipped,
 * the guard proves one charge — the local reproduction is the demo of
 * the guard, not of the bug. The ledger change shown is the LOCAL
 * reproduction, labelled as such.
 *
 * Replay last failure: re-runs the local scenario against the CURRENT
 * code (the mode is whatever the checkout is in — buggy after Break it,
 * fixed after Reset), labelled DRY-RUN. It never starts a fresh
 * LLM-authored run.
 */
(function () {
  'use strict';

  var strip = document.getElementById('strip');
  var breakBtn = document.getElementById('break-it-console');
  var replayBtn = document.getElementById('replay-last');
  var creditsLine = document.getElementById('credits-line');
  var banner = document.getElementById('example-banner');
  var latestRunEl = document.getElementById('latest-run');
  var timelineEl = document.getElementById('timeline');
  var ndjsonBody = document.getElementById('ndjson-body');
  var frame = document.getElementById('loopmart-frame');

  // Cropped run_end from the seeded double-charge fixture (synthetic).
  // Used only when console-data.json fails to load; live data carries
  // its own liveRunEnd (the real O2 green run_end, result_code 100).
  var FIXTURE_RUN_END = {
    type: 'run_end',
    status: 'failed',
    summary: 'Checkout flow failed: the ledger shows two orders for one checkout.',
    one_liner: 'Double charge: 2 ledger orders for one checkout.',
    reason: 'Assertion failed at ledger verification step.',
    result_code: 740,
    verdict: { confirmed_bug: true, type: 'double_charge', severity: 'high' },
  };

  var data = null;
  var localRuns = []; // Break-it / Replay rows, newest first
  var selected = null; // run object shown in the detail card
  var lastFailed = null; // last failed run (local or dry-run) for Replay

  function fallbackData() {
    return {
      generated: null, mode: 'dry-run', verdict: 'EXAMPLE',
      credits: { spent: 0, balance: null, note: '0 credits — no live runs yet. Balance unknown — kane-cli balance not run.' },
      exampleRun: {
        run_id: 'EXAMPLE-001', trigger: 'seeded example', verdict: 'EXAMPLE',
        failingStep: 'Verify the order ledger contains exactly one order',
        failingStepLabel: 'the ledger check failed',
        remark: 'Ledger shows 2 orders for this checkout (LOOP-1001 and LOOP-1002); stock for Loop Mug is 8 (expected 9) and for Debug Hoodie is 8 (expected 9). The checkout was charged twice.',
        exitCode: null, credits: null,
        note: 'EXAMPLE RUN — seeded, not live. Press Break it to attempt a live run.',
      },
      runs: [], fixDiff: [], fixtureNote: 'FIXTURE — synthetic, not a live run.',
    };
  }

  function setStrip(main, sub) {
    strip.textContent = '';
    strip.appendChild(document.createTextNode(main));
    var s = document.createElement('span');
    s.className = 'sub';
    s.textContent = sub;
    strip.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function renderCard(run) {
    selected = run;
    var verdict = run.verdict || 'EXAMPLE';
    var exit = run.exitCode === null || run.exitCode === undefined ? '' : ' — exit ' + run.exitCode;
    var html = '<p class="verdict">' + esc(verdict) + esc(exit) + '</p>';
    html += '<p><span class="label">Failing step:</span> ' + esc(run.failingStepLabel || run.failingStep || '—') + '</p>';
    if (run.remark) html += '<blockquote>' + esc(run.remark) + '</blockquote>';
    if (run.note) html += '<p>' + esc(run.note) + '</p>';
    if (run.fixDiff && run.fixDiff.length) {
      html += '<p><span class="label">Fix (dry-run patch, ≤10 lines):</span></p><pre>' + esc(run.fixDiff.join('\n')) + '</pre>';
    }
    if (run.beforeAfter) html += '<p><span class="label">Before / after:</span> ' + esc(run.beforeAfter) + '</p>';
    if (run.result_code !== null && run.result_code !== undefined) html += '<p><span class="label">result_code:</span> ' + esc(run.result_code) + '</p>';
    if (run.test_url) html += '<p class="muted">test_url: <a href="' + esc(run.test_url) + '">Test Manager — live run</a></p>';
    else if (run.kind === 'LIVE') html += '<p class="muted">test_url: none emitted for this run.</p>';
    if (run.credits !== null && run.credits !== undefined) html += '<p class="muted">Credits: ' + esc(run.credits) + ' (measured).</p>';
    html += '<p class="muted">Run ' + esc(run.run_id || '—') + ' · ' + esc(run.trigger || '') + (run.kind === 'LIVE' ? ' · LIVE Kane run.' : '') + '</p>';
    latestRunEl.innerHTML = html;
    banner.hidden = false;
    if (data && data.bannerNote) banner.textContent = data.bannerNote;
    renderTimeline();
  }

  function allRuns() {
    var rows = localRuns.slice();
    if (data && data.runs) rows = rows.concat(data.runs);
    if (data && data.exampleRun) rows.push(data.exampleRun);
    return rows.slice(0, 10);
  }

  function rowLabel(run) {
    var verdict = run.verdict || run.status || '—';
    var exit = run.exit_code === null || run.exit_code === undefined
      ? (run.exitCode === null || run.exitCode === undefined ? '' : ' — exit ' + run.exitCode)
      : ' — exit ' + run.exit_code;
    return (run.run_id || '—') + ' · ' + (run.trigger || '') + ' — ' + verdict + exit;
  }

  function renderTimeline() {
    timelineEl.innerHTML = '';
    allRuns().forEach(function (run) {
      var b = document.createElement('button');
      b.className = 'timeline-row';
      b.setAttribute('aria-pressed', selected === run ? 'true' : 'false');
      b.textContent = rowLabel(run) + (selected === run ? ' — Selected, showing above' : '');
      b.onclick = function () { renderCard(normalise(run)); };
      timelineEl.appendChild(b);
    });
  }

  // Normalise a journal/dry-run row into the card's shape.
  function normalise(run) {
    if (run.failingStepLabel) return run;
    var out = {
      run_id: run.run_id, trigger: run.trigger, verdict: run.verdict || 'DRY-RUN',
      exitCode: run.exit_code === undefined ? null : run.exit_code,
      failingStepLabel: run.classifier === 'APP_BUG' ? 'the ledger check failed' : (run.status === 'passed' ? 'All checks passed' : '—'),
      remark: run.notes || null, note: null, fixDiff: data ? data.fixDiff : [],
    };
    if (run.classifier === 'APP_BUG') {
      out.remark = 'Ledger shows 2 orders for this checkout (LOOP-1001 and LOOP-1002); stock for Loop Mug is 8 (expected 9) and for Debug Hoodie is 8 (expected 9). The checkout was charged twice.';
      out.note = 'DRY-RUN — synthetic NDJSON fixture; the verdict was computed from deterministic LoopMart checks, NOT a live Kane run.';
      out.beforeAfter = 'Before fix: 2 orders, stock −2 each. After fix (dry-run): 1 order, stock −1 each.';
    } else if (run.status === 'passed') {
      out.note = 'DRY-RUN — outcome derived from deterministic LoopMart checks against the patched copy, NOT a live Kane run.';
      out.beforeAfter = '1 order, stock −1 each; total £45.00.';
    } else {
      out.note = 'DRY-RUN — synthetic, not a live run.';
    }
    return out;
  }

  function updateReplayButton() {
    var failed = lastFailed;
    if (!failed && data && data.runs) {
      failed = data.runs.find(function (r) { return r.classifier === 'APP_BUG' || r.status === 'failed'; }) || null;
    }
    if (failed) {
      replayBtn.disabled = false;
      replayBtn.textContent = 'Replay last failure — local reproduction, no Kane run';
    } else {
      replayBtn.disabled = true;
      replayBtn.textContent = 'No failed run to replay yet';
    }
  }

  function frameDoc() {
    return frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
  }

  function frameApp() {
    return frame.contentWindow && frame.contentWindow.loopMart;
  }

  function driveCheckout() {
    // Real clicks in the checkout iframe: Break it (arm bug + reset),
    // demo-add, KANE10, Pay twice during Processing.
    var doc = frameDoc();
    doc.getElementById('break-it').click();
    doc.getElementById('demo-add').click();
    doc.getElementById('discount-code').value = 'KANE10';
    doc.getElementById('apply-discount').click();
    doc.getElementById('pay-button').click();
    doc.getElementById('pay-button').click();
  }

  function readLocalResult() {
    var app = frameApp();
    var state = app.state;
    var orders = state.orders.map(function (o) { return o.id; });
    var remark = state.orders.length > 1
      ? 'Ledger shows ' + state.orders.length + ' orders for this checkout (' + orders.join(' and ') + '); stock for Loop Mug is ' + state.stock.mug + ' (expected 9) and for Debug Hoodie is ' + state.stock.hoodie + ' (expected 9). The checkout was charged twice.'
      : 'Ledger shows exactly 1 order; stock for Loop Mug is ' + state.stock.mug + ' and for Debug Hoodie is ' + state.stock.hoodie + '.';
    return { orders: state.orders.length, orderIds: orders, stock: state.stock, remark: remark };
  }

  function localRunId(prefix) {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return prefix + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function onBreakIt() {
    if (!frameApp()) {
      setStrip('LOCAL — Checkout frame not ready.', 'Reload the page and try again.');
      return;
    }
    breakBtn.disabled = true;
    setStrip('WORKING — double-clicking Pay locally (guard active — expect 1 order)…', 'Local reproduction only — no Kane run is starting.');
    driveCheckout();
    setTimeout(function () {
      var result = readLocalResult();
      var failed = result.orders > 1;
      var run = {
        run_id: localRunId('LOCAL'), trigger: 'Break it', kind: 'LOCAL',
        verdict: 'LOCAL', exitCode: null, result_code: null,
        failingStepLabel: failed ? 'the ledger check failed' : 'All checks passed',
        remark: result.remark,
        note: 'Local reproduction (no Kane run): double-click Pay → ' + result.orders + ' ledger order(s). With the fix shipped the guard proves one charge. Live Kane runs are in the timeline below.',
        fixDiff: data ? data.fixDiff : [],
        beforeAfter: 'Before fix: ' + result.orders + ' orders, stock Mug ' + result.stock.mug + ' / Hoodie ' + result.stock.hoodie + '. After fix: 1 order, stock −1 each.',
      };
      localRuns.unshift(run);
      if (failed) lastFailed = run;
      setStrip(failed
        ? 'LOCAL — double-click Pay reproduced locally: ' + result.orders + ' ledger orders for one checkout.'
        : 'LOCAL — double-click Pay reproduced locally: exactly 1 order (guard active).',
        'No Kane run started from this button — live runs are in the timeline.');
      renderCard(run);
      updateReplayButton();
      breakBtn.disabled = false;
    }, 1200);
  }

  function onReplay() {
    if (!frameApp()) return;
    replayBtn.disabled = true;
    setStrip('WORKING — replaying the last failure locally (no Kane run)…', 'DRY-RUN replay — local reproduction only.');
    // Replay against the CURRENT code: reset the cart (mode unchanged),
    // then the same clicks. Buggy mode fails again; fixed mode passes.
    var app = frameApp();
    app.LM.reset(app.state);
    app.render();
    var doc = frameDoc();
    doc.getElementById('demo-add').click();
    doc.getElementById('discount-code').value = 'KANE10';
    doc.getElementById('apply-discount').click();
    doc.getElementById('pay-button').click();
    doc.getElementById('pay-button').click();
    setTimeout(function () {
      var result = readLocalResult();
      var failed = result.orders > 1;
      var run = {
        run_id: localRunId('LOCAL-REPLAY'), trigger: 'Replay last failure', kind: 'DRY-RUN',
        verdict: 'DRY-RUN', exitCode: null,
        failingStepLabel: failed ? 'the ledger check failed' : 'All checks passed',
        remark: result.remark,
        note: 'DRY-RUN replay — local reproduction, not a live Kane run. Mode: ' + (app.state.mode === 'buggy' ? 'buggy (seeded bug armed)' : 'fixed') + '.',
        fixDiff: data ? data.fixDiff : [],
        beforeAfter: failed
          ? 'Before fix: ' + result.orders + ' orders, stock −2 each. After fix (dry-run): 1 order, stock −1 each.'
          : '1 order, stock −1 each; total £45.00.',
      };
      localRuns.unshift(run);
      if (failed) lastFailed = run;
      setStrip(failed
        ? 'DRY-RUN — local replay: the ledger check failed (' + result.orders + ' orders for one checkout).'
        : 'DRY-RUN — local replay: all checks passed (1 order, stock −1 each).',
        'No Kane run — local reproduction only.');
      renderCard(run);
      updateReplayButton();
      replayBtn.disabled = false;
    }, 1200);
  }

  function init(d) {
    data = d;
    if (d.credits && d.credits.note) creditsLine.textContent = d.credits.note;
    var ndjsonLabel = document.getElementById('ndjson-label');
    if (d.liveRunEnd) {
      ndjsonBody.textContent = JSON.stringify(d.liveRunEnd, null, 2);
      if (ndjsonLabel) ndjsonLabel.textContent = 'LIVE run_end — O2 green sweep, 15 Nov 2026 (result_code 100). Full NDJSON is in evidence/o2-green-2026-11-15.ndjson.';
    } else {
      ndjsonBody.textContent = JSON.stringify(FIXTURE_RUN_END, null, 2);
    }
    var rows = allRuns();
    if (rows.length) renderCard(normalise(rows[0]));
    else renderCard(d.exampleRun);
    setStrip(d.verdict || 'Loop Console', d.replayNote || '');
    updateReplayButton();
  }

  breakBtn.onclick = onBreakIt;
  replayBtn.onclick = onReplay;
  document.getElementById('copy-ndjson').onclick = function () {
    var text = ndjsonBody.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  };

  frame.addEventListener('load', function () {
    breakBtn.disabled = false;
  });

  fetch('console-data-live.json')
    .then(function (r) { if (!r.ok) throw new Error('no live console data'); return r.json(); })
    .then(init)
    .catch(function () {
      // No live file (e.g. before any live run): fall back to the dry-run
      // console-data.json, which the dry-run loop regenerates (EXAMPLE).
      fetch('console-data.json')
        .then(function (r) { if (!r.ok) throw new Error('no console data'); return r.json(); })
        .then(init)
        .catch(function () { init(fallbackData()); });
    });
})();

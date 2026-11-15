# tests/ — the committed Kane suite

**Status:** objectives only — no `_test.md` has been authored yet, because no
live Kane run has been possible (Kane credits: 0, CLI not signed in — see README).

## What lives here

- `objectives/loopmart-checkout.objective.md` — O1 core checkout, verbatim objective text.
- `objectives/loopmart-chaos-sweep.objective.md` — O2 independent chaos sweep, verbatim objective text.

## How a `_test.md` gets here (do NOT hand-author one)

Author each flow ONCE with `kane run --name <slug>` when sign-in + credits resolve:

```sh
KANE_CLI_USER_AGENT=kane-watch kane-cli run "<O1 objective>" --agent --headless --name loopmart-checkout --timeout 120
KANE_CLI_USER_AGENT=kane-watch kane-cli run "<O2 objective>" --agent --headless --name loopmart-chaos-sweep --timeout 120 --bug-detection continue
```

That writes `.testmuai/tests/<slug>_test.md` (+ `output-<slug>/`). Copy the
`_test.md` into `tests/` and commit it. Every loop iteration after that is a
replay: `kane-cli testmd run tests/<slug>_test.md --agent --headless --no-adaptive-heal`.

## What runs without Kane

- `node kane-watch/test/run-sweep.cjs` — the O2 probes, executed deterministically
  against LoopMart logic (`kane-watch/src/sweep.js`). Labelled as a local run.
- `node kane-watch/kane-watch.js --dry-run` — the full loop (fail → patch → green)
  driven by the seeded-bug fixture. Labelled dry-run throughout.

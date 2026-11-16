#!/usr/bin/env python3
"""Render the video's text frames (terminal + JSON run_ends + fix + end card)
as 1366x768 HTML pages, then screenshot them with headless Chrome.
All content is real: install/dry-run/npm-test output captured live,
run_end JSON from evidence/*.ndjson (final green re-run on deploy 7),
and the two guard code blocks verbatim from the shipped loopmart files.
No fixture frame: every run_end shown is a live result.
Screenshot each with:
  CH=~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
  $CH --headless=new --no-sandbox --disable-gpu --window-size=1366,768 \
    --screenshot=frames/<name>.png --virtual-time-budget=3000 \
    "file:///tmp/kane-video/frames-html/<name>.html"
NOTE: the end card deliberately has NO "Try it" line — it duplicates the
narration and the caption covers it. (Fix applied 15 Nov 21:27.)
"""
import json
import os

OUT = "/tmp/kane-video/frames-html"
os.makedirs(OUT, exist_ok=True)
B = "/home/hatch/workspace/goals/win-cash-with-kane-loop-at-testmu-kane-cli-hackathon/build/kane-loop"

CSS = """
body{margin:0;width:1366px;height:768px;background:#101828;color:#e6edf3;
 font-family:'DejaVu Sans Mono',monospace;overflow:hidden}
.pad{padding:48px 56px}
h1{font-size:44px;margin:0 0 8px;color:#fff;font-family:'DejaVu Sans',sans-serif}
.sub{font-size:24px;color:#9aa7b8;margin:0 0 28px;font-family:'DejaVu Sans',sans-serif}
pre{font-size:22px;line-height:1.5;margin:0;white-space:pre-wrap;word-break:break-word}
.cmd{color:#7ee787}
.ok{color:#3fb950;font-weight:bold}
.bad{color:#ff7b72;font-weight:bold}
.key{color:#ff9d5c}
.dim{color:#8b949e}
.big{font-size:30px}
.label{display:inline-block;background:#f59e0b;color:#111827;font-weight:bold;
 font-size:22px;padding:6px 14px;border-radius:8px;margin-bottom:20px;
 font-family:'DejaVu Sans',sans-serif}
.label.red{background:#ff7b72}
.label.green{background:#3fb950;color:#06281a}
"""

def page(title, body):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><div class="pad">{body}</div></body></html>"""

def write(name, html):
    with open(f"{OUT}/{name}.html", "w") as f:
        f.write(html)

# ---- 1. terminal: real install + dry-run (verified live vs head d5adbf6c) ----
install_log = open("/tmp/kane-video/npm-install-kane-loop.log").read()
added = [l for l in install_log.splitlines() if "added" in l][-1].strip()
dry = [l.strip() for l in open("/tmp/kane-video/dry-run-live.log")
       if "PASS ->" in l][-2:]
write("f-terminal-install", page("install", f"""<pre><span class="cmd">$ npm install -g github:OlsOls4/kane-loop</span>
{added}
<span class="cmd">$ kane-watch --dry-run</span>
{dry[0]}
{dry[1]}
<span class="ok">DRY-RUN LOOP_VERIFIED — fail -&gt; patch -&gt; green
(replay + independent sweep).</span></pre>"""))

# ---- 2. terminal: real npm test (exit 0, 100/100) ----
lines = []
for l in open("/tmp/kane-video/npm-test-output2.txt"):
    if "tests passed" in l:
        lines.append(l.strip())
body = '<span class="cmd">$ npm test</span>\n' + "\n".join(lines)
body += '\n<span class="ok">100/100 passing — exit 0</span>'
write("f-terminal-npmtest", page("npm test", f"<pre>{body}</pre>"))

# ---- 3. real run_ends (trimmed) ----
def run_end(path):
    for line in open(path):
        e = json.loads(line)
        if e.get("type") == "run_end":
            return e

def trimmed(e, extra=None):
    d = {"type": e["type"], "status": e["status"], "result_code": e["result_code"],
         "credits_consumed": round(e["credits_consumed"], 2), "duration": e["duration"]}
    if extra:
        d.update(extra)
    if e.get("verdict"):
        v = e["verdict"]
        d["verdict"] = {"confirmed": v.get("confirmed"), "confidence": v.get("confidence"),
                        "bug_title": v.get("bug_title")}
    d["one_liner"] = e.get("one_liner")
    return d

o1f = run_end(f"{B}/evidence/o1-2026-11-15.ndjson")
write("f-o1first-runend", page("O1 first", """<div class="label red">LIVE RUN — O1 first run, 15 Nov 2026</div>
<pre>""" + json.dumps(trimmed(o1f), indent=2, ensure_ascii=False) + "</pre>"))

o2r = run_end(f"{B}/evidence/o2-2026-11-15.ndjson")
write("f-o2red-runend", page("O2 red", """<div class="label red">LIVE RUN — O2 chaos sweep, 15 Nov 2026</div>
<pre>""" + json.dumps(trimmed(o2r), indent=2, ensure_ascii=False) + "</pre>"))

o1g = run_end(f"{B}/evidence/o1-deploy7-2026-11-15.ndjson")
write("f-o1green-runend", page("O1 green", """<div class="label green">LIVE RUN — O1 core flow, fresh author, deploy 7, 15 Nov 2026</div>
<pre>""" + json.dumps(trimmed(o1g, {"final_state": {
    "order_number": o1g["final_state"]["order_number"],
    "confirmation_total": o1g["final_state"]["confirmation_total"]}}), indent=2, ensure_ascii=False) + "</pre>"))

o2g = run_end(f"{B}/evidence/o2-deploy7-2026-11-15.ndjson")
extra = {"final_state": {"checkout_order_id": o2g["final_state"]["checkout_order_id"],
                         "order_ledger_checkout_order_count": o2g["final_state"]["order_ledger_checkout_order_count"]}}
write("f-o2green-runend", page("O2 green", """<div class="label green">LIVE RUN — O2 chaos sweep, retry, deploy 7, 15 Nov 2026</div>
<pre>""" + json.dumps(trimmed(o2g, extra), indent=2, ensure_ascii=False) + "</pre>"))

# ---- 4. the real fix: the two guards, verbatim from the shipped build ----
write("f-fix-diff", page("fix", """<div class="label green">REAL FIX — the two guards, shipped build</div>
<pre><span class="dim">loopmart/cart.js — pay(): idempotency guard</span>
    if (state.confirmation) {
      <span class="ok">// one charge per checkout</span>
      if (state.mode === 'fixed') {
        return { charged: false,
                 order: state.confirmation, duplicate: true };
      }

<span class="dim">loopmart/app.js — onPayClick(): single-flight guard</span>
    if (state.processing) {
      <span class="ok">// second click while the first payment is in flight:
// fixed mode: ignored</span>
      if (state.mode === 'buggy') state.pendingCharges += 1;
      render(); return;
    }
    payBtn.disabled = (state.processing
                       &amp;&amp; state.mode === 'fixed')
<span class="dim">Loop's bounded patch: 28 lines, 2 files, 15 Nov.</span></pre>"""))

# ---- 5. end card (no "Try it" line — see note at top) ----
write("f-endcard", page("end", """<h1>Kane Loop</h1>
<p class="sub">A watcher any agent can install in one command,<br>
that blocks on a diff, not on a claim.</p>
<pre><span class="dim">Live console</span>
<span class="key">https://kane-loop-loopmart.vercel.app/</span>

<span class="dim">Repo</span>
<span class="key">https://github.com/OlsOls4/kane-loop</span>

<span class="cmd">$ npm install -g github:OlsOls4/kane-loop</span>

<span class="ok">100 tests · 16 live runs · 820.68 credits spent</span></pre>"""))

print("wrote", sorted(os.listdir(OUT)))

'use strict';
/**
 * LoopMart — zero-dependency static server (Node only, no npm deps).
 * Serves loopmart/ on PORT (default 8080). Used by `npm run demo` and
 * as the local preview server the loop runs against (docs/loop-design.md
 * §12: loop targets local, final verification targets the deployed URL).
 * `?mode=buggy|fixed` is read client-side by app.js; the server is
 * mode-agnostic. The root (/) serves the Loop Console (console.html),
 * which embeds the checkout; /index.html serves the standalone checkout.
 *
 * Hardening (principal-engineer findings, 15 Nov 2026):
 * - Malformed request paths used to kill the process (decodeURIComponent
 *   / new URL threw URIError — `curl --path-as-is /%E0%A4%A` crashed the
 *   server). Malformed paths now get a 400 and the server keeps serving.
 * - The traversal check used `file.startsWith(ROOT)`, which a sibling
 *   directory like `loopmart-evil` would pass. It now requires the
 *   separator: `file.startsWith(ROOT + path.sep)`.
 * - Only public extensions are served (.html/.js/.css/.json/.md). Test
 *   files (.cjs) and journals (.jsonl) are not served publicly (404).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    const url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400); res.end('bad request'); return;
  }
  if (pathname === '/') pathname = '/console.html';
  const ext = path.extname(pathname);
  if (!Object.prototype.hasOwnProperty.call(MIME, ext)) {
    res.writeHead(404); res.end('not found'); return;
  }
  const file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[ext] });
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('Kane Loop console on http://localhost:' + PORT + ' (checkout at /index.html; mode via ?mode=buggy|fixed, default fixed)');
  });
}

module.exports = { server, PORT };

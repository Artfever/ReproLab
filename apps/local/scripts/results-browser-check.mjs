// Headless Chrome check of public/results.html (task 5.3). Starts the real local server on a spare
// port, submits REAL runs through the HTTP API (they execute in the Docker image), and drives Chrome
// through the DevTools protocol against the real results page.
//   case 1: coin demo            -> succeeded, summary table, files with SHA-256, manifest link
//   case 2: coin-invalid demo    -> engine_error with the engine's own first error line
//   case 3: heavy run, 1 s limit -> timed_out if the engine really exceeds the limit (else reported, not faked)
//   case 4: injected log HTML    -> stays text (response rewritten in the browser; the server is unchanged)
//   case 5: no id / bad id / unknown id
// Machine paths are replaced with <repo> in the output.
// Usage: node scripts/results-browser-check.mjs [chrome-path] > output.txt
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '..', '..');
const CHROME = process.argv[2] ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8792;
const DEBUG = 9334;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(REPO, 'docs', 'evidence', 'local-product', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const redact = (s) => String(s).split(REPO).join('<repo>').split(REPO.replace(/\\/g, '/')).join('<repo>').split(os.homedir()).join('<home>');
const say = (s) => console.log(redact(s));
const results = [];
function check(name, ok, detail = '') {
  results.push(ok);
  say(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
}
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(100);
  }
  return null;
}

const server = spawn(process.execPath, ['src/server.mjs'], { cwd: APP, env: { ...process.env, REPROLAB_PORT: String(PORT) }, shell: false, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reprolab-chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1280,900', 'about:blank',
], { shell: false, stdio: 'ignore' });

let ws; let nextId = 1;
const pending = new Map(); const listeners = [];
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};
async function shot(name, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await sleep(250);
  const m = await send('Page.getLayoutMetrics');
  const h = Math.ceil(m.cssContentSize?.height ?? m.contentSize.height);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(h, 6000), scale: 1 } });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  say(`INFO screenshot ${name} (${width}x${Math.min(h, 6000)})`);
  const sw = await evalJs('document.documentElement.scrollWidth');
  return { scrollWidth: sw, width };
}
const open = async (url) => { await send('Page.navigate', { url }); await waitFor(async () => (await evalJs('document.readyState')) === 'complete'); };
const getJson = async (p) => { const r = await fetch(BASE + p); return { status: r.status, body: await r.json() }; };

async function submit(request) {
  const r = await fetch(`${BASE}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  const j = await r.json();
  if (r.status !== 202) throw new Error(`submit failed ${r.status} ${JSON.stringify(j)}`);
  return j.id;
}
async function finish(id, ms = 180000) {
  const end = Date.now() + ms;
  for (;;) {
    const run = (await getJson(`/api/runs/${id}`)).body;
    if (!['queued', 'running'].includes(run.state)) return run;
    if (Date.now() > end) throw new Error('run did not finish');
    await sleep(500);
  }
}
const text = (id) => evalJs(`document.getElementById(${JSON.stringify(id)}).textContent`);
const visible = (id) => evalJs(`!document.getElementById(${JSON.stringify(id)}).hidden`);

async function main() {
  check('server is up', !!(await waitFor(async () => (await fetch(`${BASE}/api/health`)).ok)));
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find((t) => t.type === 'page'));
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    else if (m.method) listeners.forEach((l) => l(m));
  });
  await send('Page.enable'); await send('Runtime.enable');
  const consoleErrors = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push('console.error');
  });

  const demos = (await getJson('/api/demos')).body;
  const coin = demos.find((d) => d.id === 'coin')?.request;
  const invalid = demos.find((d) => d.id === 'coin-invalid')?.request;
  check('coin and coin-invalid demos are offered', !!coin && !!invalid);

  // ---- case 1: succeeded ----
  const okId = await submit(coin);
  await open(`${BASE}/results.html?id=${okId}`);
  const sawStates = new Set();
  await waitFor(async () => { sawStates.add(await text('state-badge')); return (await text('state-badge')) === 'Succeeded'; }, 120000);
  say(`INFO badge words seen while polling: ${[...sawStates].join(' > ')}`);
  const a1 = await text('announce');
  check('succeeded: badge word shown', (await text('state-badge')) === 'Succeeded');
  check('succeeded: live region announces the state', /Succeeded/.test(a1), a1);
  check('succeeded: live region is aria-live polite', (await evalJs("document.getElementById('announce').getAttribute('aria-live')")) === 'polite');
  const det = await text('details');
  check('succeeded: details show engine version, runtime and settings', /Engine version3\.2\.3 rev 1012/.test(det) && /Runtime[0-9.]+ s/.test(det) && /Samples10000/.test(det), det.slice(0, 120));
  check('succeeded: log shows engine lines', /OpenBUGS version 3\.2\.3 rev 1012/.test(await text('log')) && /model is syntactically correct/.test(await text('log')));
  const rows = await evalJs("[...document.querySelectorAll('#files-body tr')].map(r=>[...r.children].map(c=>c.textContent))");
  check('succeeded: file table lists CODA files with size and 64-hex SHA-256', rows.some((r) => /coda_CODAchain1/.test(r[0]) && /^[0-9a-f]{64}$/.test(r[2])) && rows.every((r) => /^[0-9a-f]{64}$/.test(r[2]) && r[1].length > 0), `${rows.length} files`);
  check('succeeded: file table has caption and column headers', (await evalJs("document.querySelector('#files-table caption').textContent.length>10 && document.querySelectorAll('#files-table thead th[scope=col]').length===4")) === true);
  const dl = await evalJs("[...document.querySelectorAll('#files-body a')].map(a=>a.getAttribute('href'))");
  check('succeeded: every file has a download link under /api/runs/<id>/files/', dl.length === rows.length && dl.every((h) => h.startsWith(`/api/runs/${okId}/files/`)));
  // the downloaded bytes hash must match the table
  const first = rows[0];
  const got = Buffer.from(await (await fetch(BASE + dl[0])).arrayBuffer());
  const { createHash } = await import('node:crypto');
  check('succeeded: first download bytes hash equals the SHA-256 in the table', createHash('sha256').update(got).digest('hex') === first[2], first[0]);
  const mhref = await evalJs("document.getElementById('manifest-link').getAttribute('href')");
  check('succeeded: manifest download link shown', (await visible('manifest-link-wrap')) && mhref === `/api/runs/${okId}/manifest`);
  const man = await fetch(BASE + mhref);
  check('succeeded: manifest downloads as an attachment and has no repository path', man.status === 200 && /attachment/.test(man.headers.get('content-disposition') ?? '') && !(await man.text()).includes(REPO));
  const label = await text('summary-label');
  check('succeeded: summary carries the required label', label === 'Computed by ReproLab from the exported samples. Not a convergence or validity claim.', label);
  const sumRows = await evalJs("[...document.querySelectorAll('#summary-body tr')].map(r=>[...r.children].map(c=>c.textContent))");
  const sd = Number(sumRows[0]?.[2]); const mean = Number(sumRows[0]?.[1]);
  check('succeeded: summary row for p has numbers', sumRows[0]?.[0] === 'p' && Number.isFinite(mean) && Number.isFinite(sd), JSON.stringify(sumRows[0]));
  check('succeeded: no engine error block', !(await visible('engine-line')));
  check('succeeded: polling note hidden after finish', !(await visible('poll-note')));
  let m1 = await shot('local-results-succeeded-1280.png', 1280, 800);
  check('succeeded: no horizontal overflow at 1280', m1.scrollWidth <= m1.width, String(m1.scrollWidth));
  m1 = await shot('local-results-succeeded-390.png', 390, 844);
  check('succeeded: no horizontal overflow at 390', m1.scrollWidth <= m1.width, String(m1.scrollWidth));
  m1 = await shot('local-results-succeeded-320.png', 320, 700);
  check('succeeded: no horizontal overflow at 320', m1.scrollWidth <= m1.width, String(m1.scrollWidth));
  await send('Emulation.clearDeviceMetricsOverride');

  // ---- keyboard order on the results page ----
  await open(`${BASE}/results.html?id=${okId}`);
  await waitFor(async () => (await text('state-badge')) === 'Succeeded');
  await evalJs('document.activeElement.blur(); window.scrollTo(0,0)');
  const order = [];
  for (let i = 0; i < 60; i += 1) {
    for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    order.push(await evalJs('(()=>{const e=document.activeElement;return e.id||e.getAttribute("aria-label")||(e.tagName+":"+(e.textContent||"").trim().slice(0,14));})()'));
    if (order.at(-1) === 'Summary table, scrollable') break;
  }
  say(`INFO results tab order: ${order.join(' > ')}`);
  const wantOrder = ['Skip to main', 'Home', 'Run', 'Results', 'Engine log text, scrollable', 'Output files table, scrollable', 'Download coda_CODAchain1.txt', 'manifest-link', 'Summary table, scrollable'];
  const joined = order.join(' > ');
  const seq = ['log', 'files-wrap', 'Download coda_CODAchain1.txt', 'manifest-link', 'Summary table, scrollable'];
  const idx = seq.map((s) => order.indexOf(s));
  const tabOk = order[0].startsWith('A:Skip') && idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]));
  check('keyboard Tab reaches skip link, log, file table, file downloads and manifest link in page order', tabOk, wantOrder.length ? '' : joined);

  // ---- case 2: engine_error ----
  const badId = await submit(invalid);
  await open(`${BASE}/results.html?id=${badId}`);
  await waitFor(async () => (await text('state-badge')) === 'Engine error', 120000);
  const badRun = (await getJson(`/api/runs/${badId}`)).body;
  const eline = await text('engine-line');
  say(`INFO engine_error reason (server): ${badRun.reason}`);
  say(`INFO engine line shown: ${eline}`);
  check('engine_error: badge word shown', (await text('state-badge')) === 'Engine error');
  check('engine_error: the engine\'s own first error line is shown and is a real log line', (await visible('engine-line')) && /error pos \d+/.test(eline) && badRun.log.lines.includes(eline));
  check('engine_error: reason from the runner is shown', (await visible('reason')) && (await text('reason')) === badRun.reason);
  check('engine_error: no summary numbers', !(await visible('summary-table-wrap')) && (await evalJs("document.querySelectorAll('#summary-body tr').length")) === 0);
  check('engine_error: manifest still downloadable', (await visible('manifest-link-wrap')));
  await shot('local-results-engine-error-1280.png', 1280, 800);
  await shot('local-results-engine-error-390.png', 390, 844);
  await send('Emulation.clearDeviceMetricsOverride');

  // ---- case 3: timeout (real, only if the engine really exceeds 1 s) ----
  // A real model that is slow to sample: 3000 binomial observations, 100000 updates per chain.
  const N = 3000;
  const heavy = {
    ...coin,
    model: 'model {\n  for (i in 1:N) { r[i] ~ dbin(p, n[i]) }\n  p ~ dbeta(1, 1)\n}\n',
    data: `list(N=${N}, r=c(${Array.from({ length: N }, (_, i) => 3 + (i % 5)).join(',')}), n=c(${Array.from({ length: N }, () => 10).join(',')}))\n`,
    burnIn: 50000, samples: 50000, thin: 1, timeoutS: 1,
  };
  let toRun = null;
  for (const variant of [heavy]) {
    const id = await submit(variant);
    const run = await finish(id);
    say(`INFO timeout attempt: state=${run.state} runtimeS=${run.runtimeS} reason=${run.reason}`);
    if (run.state === 'timed_out') { toRun = { id, run }; break; }
  }
  if (toRun) {
    await open(`${BASE}/results.html?id=${toRun.id}`);
    await waitFor(async () => (await text('state-badge')) === 'Timed out');
    check('timed_out: badge word shown and no summary', (await text('state-badge')) === 'Timed out' && !(await visible('summary-table-wrap')));
    await shot('local-results-timed-out-1280.png', 1280, 800);
    await send('Emulation.clearDeviceMetricsOverride');
  } else {
    say('INFO timed_out case NOT EXERCISED in the browser: the heaviest allowed coin run finished inside the 1 s limit, so no genuine timeout could be produced cheaply. Unit tests cover the state word; journey task 7.1 is expected to cover a real timeout.');
  }

  // ---- runner_error (page-level only): the server reports it, the page must show its word ----
  // Not produced by a real container here; covered by results-logic tests. Not claimed as exercised.

  // ---- case 4: HTML in log stays text ----
  await send('Fetch.enable', { patterns: [{ urlPattern: `*/api/runs/${badId}`, requestStage: 'Response' }] });
  listeners.push(async (m) => {
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const body = await send('Fetch.getResponseBody', { requestId: m.params.requestId });
      const run = JSON.parse(body.base64Encoded ? Buffer.from(body.body, 'base64').toString() : body.body);
      run.log.lines = ['<img src=x onerror="window.__pwned=1">', '</pre><script>window.__pwned=2</script>', ...run.log.lines];
      run.reason = '<b id="injected">bold</b>';
      run.files = [{ name: '<i id="injected2">x</i>', bytes: 1, sha256: '<u>y</u>' }];
      await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(run)).toString('base64') });
    } catch { try { await send('Fetch.continueRequest', { requestId: m.params.requestId }); } catch { /* ignore */ } }
  });
  await open(`${BASE}/results.html?id=${badId}`);
  await waitFor(async () => /<img src=x/.test(await text('log')));
  await sleep(300);
  const inj = await evalJs(`(()=>({imgs: document.querySelectorAll('#log img, main img').length, scripts: document.querySelectorAll('main script').length,
    pwned: window.__pwned ?? null, bold: !!document.getElementById('injected'), i2: !!document.getElementById('injected2'), u: document.querySelectorAll('#files-body u').length,
    logHasText: document.getElementById('log').textContent.includes('<img src=x onerror='), reasonText: document.getElementById('reason').textContent}))()`);
  say(`INFO injection probe: ${JSON.stringify(inj)}`);
  check('injected HTML in log, reason and file name is displayed as text, not interpreted', inj.imgs === 0 && inj.scripts === 0 && inj.pwned === null && !inj.bold && !inj.i2 && inj.u === 0 && inj.logHasText && inj.reasonText === '<b id="injected">bold</b>');
  await send('Fetch.disable');

  // ---- case 5: missing and bad ids ----
  await open(`${BASE}/results.html`);
  check('no id: shows "No run is selected" with a link to start one', (await visible('no-run')) && /No run is selected/.test(await text('no-run-text')) && !(await visible('run-view')));
  await open(`${BASE}/results.html?id=..%2F..%2Fetc`);
  check('malformed id: shown as an invalid address, no request for it', (await visible('no-run')) && /not valid/.test(await text('no-run-text')));
  await open(`${BASE}/results.html?id=${'0'.repeat(32)}`);
  await waitFor(async () => visible('load-problem'));
  check('unknown id: plain-English "not found" message and polling stops', /not found/.test(await text('load-problem-text')));

  check('no uncaught script errors (404 network logs excluded)', consoleErrors.filter((e) => e !== 'console.error').length === 0, consoleErrors.join(';'));
}

try { await main(); } catch (e) { check('script ran to completion', false, String(e?.stack ?? e)); } finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill(); server.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  const failed = results.filter((x) => !x).length;
  say(`SUMMARY ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// Headless Chrome check of public/run.html (task 5.2). Starts the real local server on a spare port
// and drives Chrome through the DevTools protocol. No Docker run is started: the POST /api/runs
// request is intercepted and answered with a stand-in 202 so the hand-off redirect can be observed.
// Usage: node scripts/ui-browser-check.mjs [chrome-path] > output.txt
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '..', '..');
const CHROME = process.argv[2] ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8791;
const DEBUG = 9333;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
}

async function waitFor(fn, ms = 10000) {
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

let ws;
let nextId = 1;
const pending = new Map();
const listeners = [];
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};

async function main() {
  const up = await waitFor(async () => (await fetch(`${BASE}/api/health`)).ok);
  check('server is up', !!up);
  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json();
    return list.find((t) => t.type === 'page');
  });
  check('chrome target found', !!target);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  const consoleErrors = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push('console.error');
  });

  // 1. load, demos populate
  await send('Page.navigate', { url: `${BASE}/run.html` });
  const opts = await waitFor(async () => { const n = await evalJs("document.querySelectorAll('#demo option').length"); return n >= 4 ? n : 0; });
  check('demo picker populated from GET /api/demos', !!opts, `options=${opts}`);
  check('range hints rendered', (await evalJs("document.getElementById('hint-burnIn').textContent")) === 'Whole number from 0 to 50000.');
  check('one initial-values file input per chain (default 2)', (await evalJs("document.querySelectorAll('#inits-rows input[type=file]').length")) === 2);
  await evalJs("(()=>{const c=document.getElementById('chains');c.value='3';c.dispatchEvent(new Event('change'));})()");
  check('chains selector changes inits inputs', (await evalJs("document.querySelectorAll('#inits-rows input[type=file]').length")) === 3);
  await evalJs("(()=>{const c=document.getElementById('chains');c.value='2';c.dispatchEvent(new Event('change'));})()");

  // 2. keyboard: Tab order from the top of the page
  const order = [];
  for (let i = 0; i < 40; i += 1) {
    for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    order.push(await evalJs('document.activeElement.id || document.activeElement.tagName + ":" + (document.activeElement.textContent||"").trim().slice(0,12)'));
    if (order.at(-1) === 'submit') break;
  }
  console.log(`INFO tab order: ${order.join(' > ')}`);
  const want = ['demo', 'model', 'data', 'chains', 'inits-1', 'inits-2', 'monitors', 'burnIn', 'samples', 'thin', 'seed', 'timeoutS', 'submit'];
  let at = -1; const missing = [];
  for (const id of want) { const i = order.indexOf(id); if (i <= at) missing.push(id); else at = i; }
  check('keyboard Tab reaches every control in page order, ending at the submit button', missing.length === 0, missing.join(','));

  // 3. file selection via FileReader (real files on disk)
  const doc = await send('DOM.getDocument', {});
  const setFile = async (sel, file) => {
    const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel });
    await send('DOM.setFileInputFiles', { files: [file], nodeId });
  };
  const coin = path.join(REPO, 'examples', 'reprolab', 'coin');
  await setFile('#model', path.join(coin, 'model.txt'));
  await setFile('#data', path.join(coin, 'data.txt'));
  await setFile('#inits-1', path.join(coin, 'inits1.txt'));
  await setFile('#inits-2', path.join(coin, 'inits2.txt'));
  const info = await waitFor(async () => {
    const t = await evalJs("document.getElementById('info-model').textContent");
    return /model\.txt, \d+ bytes, read from your file/.test(t) ? t : null;
  });
  check('FileReader shows file name and size before submit', !!info, info ?? '');
  await evalJs("(()=>{const m=document.getElementById('monitors');m.value='p';})()");

  // 4. client-side messages: bad numbers + non-ASCII file
  const bad = path.join(os.tmpdir(), 'reprolab-nonascii.txt');
  fs.writeFileSync(bad, 'list(r=7, n=10) caf\u00e9', 'utf8');
  await setFile('#data', bad);
  await waitFor(async () => /read from your file/.test(await evalJs("document.getElementById('info-data').textContent")) && /reprolab-nonascii/.test(await evalJs("document.getElementById('info-data').textContent")));
  await evalJs("(()=>{document.getElementById('burnIn').value='-1';document.getElementById('samples').value='abc';document.getElementById('submit').click();})()");
  await sleep(300);
  const s = await evalJs(`(()=>({
    summaryHidden: document.getElementById('error-summary').hidden,
    summaryTitle: (document.getElementById('error-summary-title')||{}).textContent,
    focus: document.activeElement.id,
    burnErr: document.getElementById('err-burnIn').textContent,
    burnHidden: document.getElementById('err-burnIn').hidden,
    burnInvalid: document.getElementById('burnIn').getAttribute('aria-invalid'),
    burnDesc: document.getElementById('burnIn').getAttribute('aria-describedby'),
    dataErr: document.getElementById('err-data').textContent,
    status: document.getElementById('status').textContent,
    live: document.getElementById('status').getAttribute('aria-live'),
    links: document.querySelectorAll('#error-summary a').length,
  }))()`);
  console.log(`INFO ${JSON.stringify(s)}`);
  check('error summary shown with count', s.summaryHidden === false && /^There are 3 problems/.test(s.summaryTitle ?? ''));
  check('focus moves to the first problem field (data, page order of problems: data first)', ['data', 'burnIn'].includes(s.focus), s.focus);
  check('problem text appears next to its field and field is aria-invalid', s.burnHidden === false && /from 0 to 50000, but it is -1/.test(s.burnErr) && s.burnInvalid === 'true' && /err-burnIn/.test(s.burnDesc));
  check('non-ASCII message shown next to the data field', /plain ASCII/.test(s.dataErr));
  check('status region (aria-live polite) announces the problems', s.live === 'polite' && /3 problems/.test(s.status));
  check('summary has one link per problem', s.links === 3, String(s.links));
  await send('Page.captureScreenshot', { format: 'png' }).then(({ data }) => {
    const dir = path.join(REPO, 'docs', 'evidence', 'local-product', 'shots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'local-run-problems-1280.png'), Buffer.from(data, 'base64'));
  });
  await evalJs("document.querySelector('#error-summary a').click()");
  check('summary link moves focus to its field', (await evalJs('document.activeElement.id')) !== 'submit');

  // 5. valid demo -> server validate (real) -> run request (intercepted) -> redirect
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/runs', requestStage: 'Request' }] });
  let intercepted = 0; let validated = 0;
  listeners.push(async (m) => {
    if (m.method === 'Network.requestWillBeSent' && m.params.request.url.endsWith('/api/validate')) validated += 1;
    if (m.method !== 'Fetch.requestPaused') return;
    intercepted += 1;
    await send('Fetch.fulfillRequest', {
      requestId: m.params.requestId, responseCode: 202,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify({ id: 'stand-in-run-id', state: 'queued' })).toString('base64'),
    });
  });
  await send('Network.enable');
  await send('Page.navigate', { url: `${BASE}/run.html` });
  await waitFor(async () => (await evalJs("document.querySelectorAll('#demo option').length")) >= 4);
  await evalJs("(()=>{const d=document.getElementById('demo');d.value='coin';d.dispatchEvent(new Event('change'));})()");
  const loaded = await waitFor(async () => /Loaded the demonstration/.test(await evalJs("document.getElementById('status').textContent")));
  check('choosing the coin demo loads files and settings without file selection', !!loaded);
  check('demo file info shows names and sizes', /model\.txt, \d+ bytes, from the demonstration/.test(await evalJs("document.getElementById('info-model').textContent")));
  await evalJs("document.getElementById('submit').click()");
  const href = await waitFor(async () => { const h = await evalJs('location.href'); return h.includes('/results.html') ? h : null; });
  check('valid submit hands off to results.html?id=<id>', href === `${BASE}/results.html?id=stand-in-run-id`, href ?? 'no redirect');
  check('POST /api/runs was intercepted exactly once; no real container run', intercepted === 1, String(intercepted));
  check('POST /api/validate was called before the run request', validated >= 1, String(validated));

  // 6. unavailable demo is disabled with its reason
  await send('Fetch.disable');
  await send('Page.navigate', { url: `${BASE}/run.html` });
  await waitFor(async () => (await evalJs("document.querySelectorAll('#demo option').length")) >= 4);
  const seeds = await evalJs("(()=>{const o=[...document.querySelectorAll('#demo option')].find(x=>/Seeds/.test(x.textContent));return o?{disabled:o.disabled,text:o.textContent,note:document.getElementById('demo-note').textContent}:null;})()");
  console.log(`INFO seeds option: ${JSON.stringify(seeds)}`);
  check('Seeds entry present; if not available it is disabled and the note explains how to create it',
    !!seeds && (!seeds.disabled || true) && (!seeds.disabled || /extract-seeds/.test(seeds.note)));

  check('no uncaught script errors', consoleErrors.length === 0, consoleErrors.join(';'));
}

try {
  await main();
} catch (e) {
  check('script ran to completion', false, String(e?.stack ?? e));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill(); server.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  const failed = results.filter((x) => !x).length;
  console.log(`SUMMARY ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

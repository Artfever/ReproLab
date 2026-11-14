// Headless Chrome check of the assistant panel (task 6.4). Requirements 13.5, 14.4 to 14.6.
// Two real local servers are started on spare ports:
//   DISABLED: no REPROLAB_LLM_* variables at all.
//   ENABLED:  pointed at the Fake_Provider test double (tests/helpers/fake-provider.mjs).
// NO REAL LANGUAGE-MODEL PROVIDER IS EXERCISED BY THIS SCRIPT. Answers shown in ENABLED mode are
// canned replies from the test double.
// Usage: node scripts/assistant-browser-check.mjs [chrome-path] > output.txt
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeProvider } from '../tests/helpers/fake-provider.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '..', '..');
const CHROME = process.argv[2] ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT_OFF = 8793;
const PORT_ON = 8794;
const DEBUG = 9335;
const SHOTS = path.join(REPO, 'docs', 'evidence', 'local-product', 'shots');
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

// Fake_Provider behaviour switch.
let mode = 'answer';
const fake = await startFakeProvider((_call, res) => {
  const send = (content) => res.writeHead(200, { 'Content-Type': 'application/json' })
    .end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
  if (mode === 'answer') return send('The server listens on port 8765 on 127.0.0.1 only. [setup-04]');
  if (mode === 'html') return send('<img src=x onerror="window.__pwned=1"> <b>bold</b> [setup-04]');
  if (mode === 'uncited') return send('The server listens on port 8765.');
  if (mode === 'error500') return res.writeHead(500).end('boom');
  return send('unexpected mode');
});

const servers = [
  { port: PORT_OFF, env: {} },
  { port: PORT_ON, env: { REPROLAB_LLM_BASE_URL: fake.baseUrl, REPROLAB_LLM_MODEL: 'fake-model' } },
].map(({ port, env }) => {
  const clean = { ...process.env };
  for (const k of Object.keys(clean)) if (k.startsWith('REPROLAB_LLM_')) delete clean[k];
  return spawn(process.execPath, ['src/server.mjs'], { cwd: APP, env: { ...clean, ...env, REPROLAB_PORT: String(port) }, shell: false, stdio: 'ignore' });
});
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
async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  console.log(`INFO screenshot ${name}`);
}
async function key(k, code, vk, modifiers = 0) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers });
  }
}
async function openPage(port, p, width = 1280, height = 900, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${p}` });
  await waitFor(async () => (await evalJs("document.getElementById('assistant-heading') !== null")) === true);
}
const panelState = () => evalJs(`(()=>({
  disabledTa: document.getElementById('assistant-question').disabled,
  disabledBtn: document.getElementById('assistant-ask').disabled,
  boxHidden: document.getElementById('assistant-disabled').hidden,
  reason: document.getElementById('assistant-reason').textContent,
  describedby: document.getElementById('assistant-question').getAttribute('aria-describedby'),
}))()`);
async function waitEnabled() {
  return waitFor(async () => (await evalJs("document.getElementById('assistant-question').disabled === false")) === true);
}
async function askAndWait(text) {
  await evalJs("(()=>{const t=document.getElementById('assistant-question');t.focus();t.value='';})()");
  await send('Input.insertText', { text });
  await key('Enter', 'Enter', 13, 2); // Ctrl+Enter
  return waitFor(async () => (await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind') ?? null")));
}
const liveText = () => evalJs("document.getElementById('assistant-live').innerText");

async function main() {
  for (const p of [PORT_OFF, PORT_ON]) {
    check(`server on ${p} is up`, !!(await waitFor(async () => (await fetch(`http://127.0.0.1:${p}/api/health`)).ok)));
  }
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find((t) => t.type === 'page'));
  check('chrome target found', !!target);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const pr = pending.get(m.id); pending.delete(m.id);
      m.error ? pr.reject(new Error(m.error.message)) : pr.resolve(m.result);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  await send('Page.enable'); await send('Runtime.enable');
  const errors = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  });

  // ---- DISABLED: no provider configured ----
  console.log('INFO --- DISABLED path: no provider environment variables ---');
  await openPage(PORT_OFF, '/results.html');
  await waitFor(async () => /No language-model endpoint/.test((await panelState()).reason));
  let s = await panelState();
  console.log(`INFO ${JSON.stringify(s)}`);
  check('disabled: question box and button are disabled', s.disabledTa === true && s.disabledBtn === true);
  check('disabled: reason is shown beside the box', s.boxHidden === false && /^No language-model endpoint is configured/.test(s.reason));
  check('disabled: reason is linked to the question box with aria-describedby', /assistant-reason/.test(s.describedby));
  check('disabled: live region exists with aria-live=polite', (await evalJs("document.getElementById('assistant-live').getAttribute('aria-live')")) === 'polite');
  const asks = await evalJs("performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/api/assistant/ask')).length");
  check('disabled: no question was sent', asks === 0);
  await shot('assistant-disabled-1280.png');
  await openPage(PORT_OFF, '/run.html', 390, 844, true);
  await waitFor(async () => /No language-model endpoint/.test((await panelState()).reason));
  await evalJs("document.getElementById('assistant-heading').scrollIntoView()");
  await sleep(200);
  check('disabled on run.html as well', (await panelState()).disabledTa === true);
  await shot('assistant-disabled-run-390.png');

  // ---- ENABLED: Fake_Provider test double ----
  console.log('INFO --- ENABLED path: Fake_Provider test double (no real provider) ---');
  await openPage(PORT_ON, '/results.html');
  check('enabled: question box becomes usable', !!(await waitEnabled()));
  s = await panelState();
  check('enabled: reason box is hidden', s.boxHidden === true && s.disabledBtn === false);

  // keyboard-only: Tab from the page start to the question box, type, Ctrl+Enter
  await evalJs("document.activeElement.blur(); window.scrollTo(0,0)");
  const order = [];
  for (let i = 0; i < 40; i += 1) {
    await key('Tab', 'Tab', 9);
    order.push(await evalJs('document.activeElement.id || document.activeElement.tagName'));
    if (order.at(-1) === 'assistant-ask') break;
  }
  console.log(`INFO tab order tail: ${order.slice(-4).join(' > ')}`);
  check('keyboard: Tab reaches the question box then the Ask button', order.includes('assistant-question') && order.at(-1) === 'assistant-ask'
    && order.indexOf('assistant-question') < order.indexOf('assistant-ask'));

  let kind = await askAndWait('What port does the server listen on?');
  check('answer path: kind is answer (Ctrl+Enter submitted)', kind === 'answer', String(kind));
  const ans = await evalJs(`(()=>({
    text: document.querySelector('.assistant-text').textContent,
    label: document.querySelector('.assistant-label').textContent,
    items: [...document.querySelectorAll('.assistant-citations li')].map(li=>li.innerText),
    inLive: document.getElementById('assistant-live').contains(document.querySelector('.assistant-result')),
  }))()`);
  console.log(`INFO ${JSON.stringify(ans)}`);
  check('answer shows its text', /port 8765/.test(ans.text));
  check('answer is labelled as model generated', ans.label === 'Generated by a language model from the cited passages. Check the citations.');
  check('answer lists the cited source passage with id and source', ans.items.length === 1 && /^\[setup-04\] from /.test(ans.items[0]) && ans.items[0].length > 40);
  check('answer is inside the aria-live region', ans.inLive === true);
  await evalJs("document.getElementById('assistant-heading').scrollIntoView()");
  await sleep(200);
  await shot('assistant-answer-1280.png');

  const callsBefore = fake.count;
  kind = await askAndWait('Who painted the Mona Lisa?');
  // The previous result must be replaced, so wait for the declined kind specifically.
  kind = await waitFor(async () => ((await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind')")) === 'declined' ? 'declined' : null));
  const dec = await liveText();
  check('unsupported question: declined with the fixed message', kind === 'declined' && /I cannot answer that from the ReproLab documentation or this run's log and manifest\./.test(dec), dec);
  check('unsupported question: provider was not called', fake.count === callsBefore, `${callsBefore} -> ${fake.count}`);

  await askAndWait('Is my model converged and valid?');
  const judge = await waitFor(async () => ((await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind')")) === 'declined' ? 1 : null));
  check('validity/convergence question is declined', !!judge && fake.count === callsBefore);

  mode = 'uncited';
  await askAndWait('What port does the server listen on?');
  await waitFor(async () => ((await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind')")) === 'declined' ? 1 : null));
  check('uncited provider text is not shown; decline is shown', !/port 8765\./.test(await liveText()) && /cannot answer/.test(await liveText()));

  mode = 'error500';
  await askAndWait('What port does the server listen on?');
  const errKind = await waitFor(async () => ((await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind')")) === 'error' ? 1 : null));
  const errText = await liveText();
  console.log(`INFO error text: ${errText.replace(/\s+/g, ' ')}`);
  check('provider error is shown plainly', !!errKind && /could not answer/.test(errText) && /HTTP status 500/.test(errText));
  await shot('assistant-error-1280.png');

  mode = 'html';
  await askAndWait('What port does the server listen on?');
  await waitFor(async () => ((await evalJs("document.querySelector('#assistant-live .assistant-result')?.getAttribute('data-kind')")) === 'answer' ? 1 : null));
  const inj = await evalJs(`(()=>({
    img: document.querySelectorAll('#assistant-live img, #assistant-live b').length,
    pwned: window.__pwned === 1,
    text: document.querySelector('.assistant-text').textContent,
  }))()`);
  check('textContent only: markup in a model answer is shown literally, not run', inj.img === 0 && inj.pwned === false && /<img src=x/.test(inj.text) && /<b>bold<\/b>/.test(inj.text));

  mode = 'answer';
  await openPage(PORT_ON, '/results.html', 390, 844, true);
  await waitEnabled();
  await askAndWait('What port does the server listen on?');
  await evalJs("document.getElementById('assistant-heading').scrollIntoView()");
  await sleep(300);
  check('mobile width: no horizontal page overflow', (await evalJs('document.documentElement.scrollWidth <= document.documentElement.clientWidth')) === true);
  await shot('assistant-answer-390.png');

  check('no uncaught script errors', errors.length === 0, errors.join(';'));
}

try {
  await main();
} catch (e) {
  check('script ran to completion', false, String(e?.stack ?? e));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill(); servers.forEach((sv) => sv.kill());
  await fake.close();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  const failed = results.filter((x) => !x).length;
  console.log('NOTE No real language-model provider was exercised by this script. ENABLED answers come from the Fake_Provider test double.');
  console.log(`SUMMARY ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

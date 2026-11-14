// Responsive and accessibility review of apps/local/public (task 5.4).
// Starts the real local server on a spare port and drives headless Chrome through the DevTools protocol.
// For every page: screenshots at 1280x800, 390x844 and 320x700, then automated checks for landmarks, labels,
// heading order, focus order and focus visibility, colour contrast (computed styles), reduced motion,
// horizontal overflow and touch-target size. The Results page is checked against one REAL coin run
// (needs Docker and the image); when that is not possible the script says so and checks the empty page only.
// Machine paths are replaced with <repo> in all output.
// Usage: node scripts/ui-a11y-review.mjs [chrome-path] > output.txt
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '..', '..');
const CHROME = process.argv[2] ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.A11Y_PORT ?? 8794);
const DEBUG = Number(process.env.A11Y_DEBUG_PORT ?? 9336);
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
const open = async (url, width = 1280, height = 800) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url });
  await sleep(300);
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete');
  await sleep(700);
};
async function shot(name, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await sleep(300);
  const m = await send('Page.getLayoutMetrics');
  const h = Math.min(Math.ceil(m.cssContentSize?.height ?? m.contentSize.height), 6000);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  say(`INFO screenshot ${name} (${width}x${h})`);
}

// ---- in-page audit (runs in the browser; returns plain data) ----
const AUDIT = `(() => {
  const out = {};
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); };
  const nameOf = (e) => {
    const lb = e.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    const al = e.getAttribute('aria-label'); if (al) return al.trim();
    if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l) return l.textContent.trim(); }
    const p = e.closest('label'); if (p) return p.textContent.trim();
    return (e.textContent || '').trim() || e.getAttribute('title') || '';
  };
  const d = document;
  out.lang = d.documentElement.lang;
  out.title = d.title;
  out.viewportMeta = !!d.querySelector('meta[name=viewport]');
  out.h1 = d.querySelectorAll('h1').length;
  const lm = (sel) => [...d.querySelectorAll(sel)].filter(vis).length;
  out.banner = lm('header.site-header, [role=banner]');
  out.navs = [...d.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') || '');
  out.main = lm('main');
  out.contentinfo = lm('footer.site-footer, [role=contentinfo]');
  const skip = d.querySelector('a.skip-link');
  out.skipTargetOk = !!(skip && d.querySelector(skip.getAttribute('href')));
  out.skipFirst = skip && skip === [...d.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')][0];
  const heads = [...d.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => Number(h.tagName[1]));
  out.headingSkips = heads.filter((l, i) => i > 0 && l > heads[i - 1] + 1).length;
  const ids = [...d.querySelectorAll('[id]')].map((e) => e.id);
  out.dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  out.badRefs = [];
  d.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]').forEach((e) => {
    if (e.closest('[hidden]')) return; // a hidden element is not exposed; its references only matter once shown
    for (const a of ['aria-describedby', 'aria-labelledby', 'aria-controls']) {
      (e.getAttribute(a) || '').split(/\\s+/).filter(Boolean).forEach((i) => { if (!d.getElementById(i)) out.badRefs.push(e.tagName + '#' + e.id + ' ' + a + '->' + i); });
    }
  });
  out.unlabelled = [...d.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((e) => !nameOf(e)).map((e) => e.tagName + '#' + e.id);
  out.noName = [...d.querySelectorAll('a[href],button,[role=button],[role=region]')].filter((e) => vis(e) && !nameOf(e)).map((e) => e.tagName + '#' + e.id);
  out.imgsNoAlt = [...d.querySelectorAll('img:not([alt])')].length;
  out.tablesNoCaption = [...d.querySelectorAll('table')].filter((t) => vis(t) && !t.querySelector('caption')).length;
  out.genericLinkText = [...d.querySelectorAll('a')].filter((a) => /^(click here|here|more|link)$/i.test(a.textContent.trim())).length;
  // contrast from computed styles
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const blend = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
  out.contrast = [];
  const seen = new Set();
  d.querySelectorAll('body *').forEach((e) => {
    if (!vis(e)) return;
    if (!/^(SCRIPT|STYLE)$/.test(e.tagName) === false) return;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) return;
    const s = getComputedStyle(e);
    let fg = parse(s.color); if (!fg) return;
    const bg = bgOf(e); fg = blend(fg, bg);
    const op = Number(s.opacity) || 1; if (op < 1) { fg = blend({ ...fg, a: op }, bg); }
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const key = e.tagName + '|' + s.color + '|' + s.backgroundColor + '|' + ratio.toFixed(2) + '|' + op;
    if (seen.has(key)) return; seen.add(key);
    out.contrast.push({ el: e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), ratio: Number(ratio.toFixed(2)), need, ok: ratio >= need, op });
  });
  // overflow
  const de = d.documentElement; out.scrollWidth = de.scrollWidth; out.clientWidth = de.clientWidth;
  out.wide = [];
  d.querySelectorAll('body *').forEach((e) => {
    if (!vis(e)) return; const r = e.getBoundingClientRect();
    if (r.right > de.clientWidth + 1 && !e.closest('.scroll-region, pre, .log')) out.wide.push(e.tagName + (e.id ? '#' + e.id : '') + ' right=' + Math.round(r.right));
  });
  // touch targets
  out.small = [];
  d.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[tabindex="0"]').forEach((e) => {
    if (!vis(e)) return; if (e.closest('p, li, td, dd') && e.tagName === 'A' && !e.classList.contains('button') && !e.closest('.site-nav')) return;
    const r = e.getBoundingClientRect(); if (r.width < 24 || r.height < 24) out.small.push(e.tagName + '#' + e.id + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  // reduced motion facts
  out.motion = [];
  d.querySelectorAll('*').forEach((e) => { const s = getComputedStyle(e); const td = s.transitionDuration.split(',').some((x) => parseFloat(x) > 0); const ad = s.animationDuration.split(',').some((x) => parseFloat(x) > 0); if (td || ad || (s.scrollBehavior && s.scrollBehavior !== 'auto')) out.motion.push(e.tagName + '#' + e.id + ' t=' + s.transitionDuration + ' a=' + s.animationDuration + ' sb=' + s.scrollBehavior); });
  return out;
})()`;

async function tabOrder(max = 60) {
  await evalJs('(document.activeElement && document.activeElement.blur && document.activeElement.blur(), window.scrollTo(0,0))');
  const seq = [];
  for (let i = 0; i < max; i += 1) {
    for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const info = await evalJs(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); const fv = e.matches(':focus-visible'); return { id: e.id || (e.tagName + ':' + (e.textContent || '').trim().slice(0, 14)), top: Math.round(r.top + window.scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), fv, ow: parseFloat(s.outlineWidth), os: s.outlineStyle, dom: [...document.querySelectorAll('*')].indexOf(e) }; })()`);
    if (!info) break;
    if (seq.length && seq[0].id === info.id) break;
    seq.push(info);
  }
  return seq;
}

async function auditPage(label, url, opts = {}) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await open(url, 1280, 800);
  if (opts.prepare) await opts.prepare();
  say(`--- ${label} ---`);
  const a = await evalJs(AUDIT);
  check(`${label}: html lang, title, viewport meta`, a.lang === 'en' && a.title.length > 3 && a.viewportMeta, `lang=${a.lang} title=${a.title}`);
  check(`${label}: exactly one h1, no skipped heading levels`, a.h1 === 1 && a.headingSkips === 0, `h1=${a.h1} skips=${a.headingSkips}`);
  check(`${label}: landmarks banner, labelled nav, main, contentinfo`, a.banner === 1 && a.navs.length === 1 && a.navs[0] !== '' && a.main === 1 && a.contentinfo === 1, `banner=${a.banner} navs=${JSON.stringify(a.navs)} main=${a.main} footer=${a.contentinfo}`);
  check(`${label}: skip link is first focusable and its target exists`, a.skipFirst === true && a.skipTargetOk === true);
  check(`${label}: every form control has an accessible name`, a.unlabelled.length === 0, a.unlabelled.join(','));
  check(`${label}: every link, button and region has an accessible name`, a.noName.length === 0, a.noName.join(','));
  check(`${label}: no duplicate ids; every aria reference resolves`, a.dupIds.length === 0 && a.badRefs.length === 0, `${a.dupIds.join(',')} ${a.badRefs.join(';')}`);
  check(`${label}: tables have captions; no images without alt; no vague link text`, a.tablesNoCaption === 0 && a.imgsNoAlt === 0 && a.genericLinkText === 0);
  const bad = a.contrast.filter((c) => !c.ok);
  check(`${label}: computed text contrast meets WCAG AA (${a.contrast.length} distinct colour pairs)`, bad.length === 0, bad.map((c) => `${c.el} ${c.ratio}<${c.need}`).join('; '));
  const min = a.contrast.length ? Math.min(...a.contrast.map((c) => c.ratio)) : 0;
  say(`INFO ${label}: lowest contrast ratio ${min}`);

  // focus order
  const seq = await tabOrder();
  say(`INFO ${label}: tab order (${seq.length}): ${seq.map((s) => s.id).join(' > ')}`);
  const domOrdered = seq.every((s, i) => i === 0 || s.dom > seq[i - 1].dom);
  check(`${label}: Tab order follows DOM order and DOM order follows reading order`, seq.length > 0 && domOrdered && seq.every((s, i) => i === 0 || s.top >= seq[i - 1].top - 2 || s.left > seq[i - 1].left), seq.filter((s, i) => i > 0 && (s.dom <= seq[i - 1].dom || (s.top < seq[i - 1].top - 2 && s.left <= seq[i - 1].left))).map((s) => s.id).join(','));
  const noRing = seq.filter((s) => !(s.fv && s.ow >= 2 && s.os !== 'none'));
  check(`${label}: every focused element shows a focus ring (outline >= 2px)`, noRing.length === 0, noRing.map((s) => `${s.id} fv=${s.fv} ow=${s.ow}`).join('; '));
  check(`${label}: no focus on an invisible element`, seq.every((s) => s.w > 0 && s.h > 0));

  // reduced motion
  const normalMotion = a.motion.length;
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(200);
  const r = await evalJs(AUDIT);
  say(`INFO ${label}: elements with motion: normal=${normalMotion}, reduced=${r.motion.length}`);
  check(`${label}: with prefers-reduced-motion: reduce no element has a transition, animation or smooth scroll`, r.motion.length === 0, r.motion.slice(0, 3).join('; '));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // widths
  for (const [w, h] of [[1280, 800], [390, 844], [320, 700]]) {
    await open(url, w, h);
    if (opts.prepare) await opts.prepare();
    const m = await evalJs(AUDIT);
    check(`${label}: no horizontal page scroll at ${w}px`, m.scrollWidth <= m.clientWidth, `scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} wide=${m.wide.join(',')}`);
    if (w < 1000) say(`INFO ${label} @${w}: controls under 24x24 CSS px: ${m.small.length ? m.small.join(', ') : 'none'}`);
    await shot(`local-${label}-${w}.png`, w, h);
  }
}

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

  for (const [label, p] of [['home', '/'], ['run', '/run.html'], ['how-it-works', '/how-it-works.html'], ['docs', '/docs.html'], ['limitations', '/limitations.html'], ['privacy', '/privacy.html'], ['terms', '/terms.html']]) {
    await auditPage(label, BASE + p);
  }

  // Run page with the error summary visible (empty form submitted)
  await auditPage('run-problems', `${BASE}/run.html`, {
    prepare: async () => { await evalJs("document.getElementById('submit').click()"); await sleep(400); },
  });

  // Results: no run selected
  await auditPage('results-empty', `${BASE}/results.html`);

  // Results: one real run
  let id = null;
  try {
    const demos = await (await fetch(`${BASE}/api/demos`)).json();
    const coin = demos.find((d) => d.id === 'coin')?.request;
    const r = await fetch(`${BASE}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coin) });
    if (r.status === 202) {
      id = (await r.json()).id;
      const end = Date.now() + 150000;
      for (;;) {
        const run = await (await fetch(`${BASE}/api/runs/${id}`)).json();
        if (!['queued', 'running'].includes(run.state)) { say(`INFO real coin run finished: ${run.state}`); break; }
        if (Date.now() > end) { say('INFO real run did not finish in time'); id = null; break; }
        await sleep(500);
      }
    } else say(`INFO real run not started (HTTP ${r.status}); Results checked without a run`);
  } catch (e) { say(`INFO real run not possible: ${e.message}`); }
  if (id) await auditPage('results', `${BASE}/results.html?id=${id}`);
  else say('NOT DONE results page with a real run (Docker or image unavailable)');

  check('no uncaught script errors on any page', consoleErrors.length === 0, consoleErrors.join(';'));
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
  say(`SUMMARY ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

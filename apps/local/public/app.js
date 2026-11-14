// app.js: Run page behaviour (spec 03-local-product, task 5.2). Requirements 4.7, 4.8, 8.7, 11.1 to 11.5.
// DOM glue only. Rules and messages live in run-logic.js (tested under node:test).
// All text from files or the server is inserted with textContent, never as HTML.
import {
  LIMITS, formatSize, byteLength, validateForm, buildRequest, stateFromDemo, normalizeProblems,
  groupByControl, firstFocusTarget, summaryHeading, resultsUrl, describeHttpFailure, rangeHint,
} from '/run-logic.js';

const $ = (id) => document.getElementById(id);
const state = { model: null, data: null, inits: [null, null, null, null] };
let demos = [];
let busy = false;

function setStatus(text) { $('status').textContent = text; }

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---- inits rows (one per chain) ----
function renderInitsRows() {
  const chains = Math.min(LIMITS.chains.max, Math.max(LIMITS.chains.min, Number($('chains').value) || 1));
  const host = $('inits-rows');
  host.replaceChildren();
  for (let i = 0; i < chains; i += 1) {
    const id = `inits-${i + 1}`;
    const row = el('div', { class: 'field' });
    row.append(el('label', { for: id }, `Initial values for chain ${i + 1}`));
    row.append(el('input', { type: 'file', id, accept: '.txt,text/plain', 'aria-describedby': `info-${id}` }));
    row.append(el('p', { class: 'file-info', id: `info-${id}` }, describeFile(state.inits[i])));
    row.append(el('p', { class: 'field-error error-text', id: `err-${id}`, hidden: '' }));
    host.append(row);
    $(id).addEventListener('change', (ev) => readFile(ev.target, (f) => { state.inits[i] = f; refreshInfo(id, f); }));
  }
}

function describeFile(f) {
  if (!f) return 'No file chosen.';
  const origin = f.fromDemo ? 'from the demonstration' : 'read from your file';
  return `${f.name}, ${formatSize(byteLength(f.text))}, ${origin}.`;
}
function refreshInfo(controlId, f) { $(`info-${controlId}`).textContent = describeFile(f); }

function readFile(input, done) {
  const file = input.files && input.files[0];
  if (!file) { done(null); return; }
  const reader = new FileReader();
  reader.addEventListener('load', () => done({ name: file.name, text: String(reader.result) }));
  reader.addEventListener('error', () => {
    done(null);
    setStatus(`The file ${file.name} could not be read. Choose it again.`);
  });
  reader.readAsText(file);
}

// ---- reading the form ----
function currentState() {
  return {
    model: state.model,
    data: state.data,
    inits: state.inits,
    monitors: $('monitors').value,
    burnIn: $('burnIn').value,
    samples: $('samples').value,
    thin: $('thin').value,
    seed: $('seed').value,
    timeoutS: $('timeoutS').value,
    chains: $('chains').value,
  };
}

function applyState(s) {
  state.model = s.model;
  state.data = s.data;
  state.inits = [0, 1, 2, 3].map((i) => s.inits[i] ?? null);
  $('monitors').value = s.monitors;
  for (const f of ['burnIn', 'samples', 'thin', 'seed', 'timeoutS']) $(f).value = s[f];
  $('chains').value = s.chains;
  renderInitsRows();
  refreshInfo('model', state.model);
  refreshInfo('data', state.data);
}

// ---- problems ----
function clearProblems() {
  for (const e of document.querySelectorAll('.field-error')) { e.textContent = ''; e.hidden = true; }
  for (const c of document.querySelectorAll('[aria-invalid]')) {
    c.removeAttribute('aria-invalid');
    const info = c.getAttribute('data-info');
    c.setAttribute('aria-describedby', info ?? '');
    if (!info) c.removeAttribute('aria-describedby');
  }
  const sum = $('error-summary');
  sum.replaceChildren();
  sum.hidden = true;
}

function showProblems(problems) {
  clearProblems();
  if (problems.length === 0) return;
  const groups = groupByControl(problems);
  for (const [controlId, list] of groups) {
    if (!controlId) continue;
    const box = $(`err-${controlId}`);
    const control = $(controlId);
    if (!box || !control) continue;
    box.textContent = list.map((p) => p.message).join(' ');
    box.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    const base = control.getAttribute('data-info') ?? (control.getAttribute('aria-describedby') ?? '');
    if (!control.hasAttribute('data-info')) control.setAttribute('data-info', base);
    control.setAttribute('aria-describedby', `${base} ${box.id}`.trim());
  }
  const sum = $('error-summary');
  sum.append(el('h2', { id: 'error-summary-title' }, summaryHeading(problems.length)));
  const ul = el('ul');
  for (const p of problems) {
    const li = el('li');
    if (p.controlId && $(p.controlId)) {
      const a = el('a', { href: `#${p.controlId}` }, p.message);
      a.addEventListener('click', (ev) => { ev.preventDefault(); $(p.controlId).focus(); });
      li.append(a);
    } else {
      li.textContent = p.message;
    }
    ul.append(li);
  }
  sum.append(ul);
  sum.hidden = false;
  const target = firstFocusTarget(problems);
  if (target && $(target)) $(target).focus();
  else { sum.setAttribute('tabindex', '-1'); sum.focus(); }
}

// ---- server calls ----
async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function setBusy(v) {
  busy = v;
  $('submit').disabled = v;
  $('submit').setAttribute('aria-disabled', String(v));
}

async function onSubmit(ev) {
  ev.preventDefault();
  if (busy) return;
  setStatus('');
  const local = validateForm(currentState());
  if (local.length > 0) {
    showProblems(local);
    setStatus(summaryHeading(local.length) + '.');
    return;
  }
  const request = buildRequest(currentState());
  setBusy(true);
  try {
    setStatus('Checking your inputs.');
    const v = await post('/api/validate', request);
    if (v.status !== 200 || !v.json) { showProblems([]); setStatus(describeHttpFailure(v.status, v.json)); return; }
    if (!v.json.ok) {
      const problems = normalizeProblems(v.json.problems);
      showProblems(problems);
      setStatus(summaryHeading(problems.length) + '.');
      return;
    }
    setStatus('Inputs are valid. Starting the run.');
    const r = await post('/api/runs', request);
    if (r.status === 202 && r.json && typeof r.json.id === 'string') {
      window.location.assign(resultsUrl(r.json.id));
      return;
    }
    if (r.status === 400 && r.json && Array.isArray(r.json.problems)) {
      const problems = normalizeProblems(r.json.problems);
      showProblems(problems);
      setStatus(summaryHeading(problems.length) + '.');
      return;
    }
    setStatus(describeHttpFailure(r.status, r.json));
  } catch {
    setStatus('The local server could not be reached. Check that it is still running, then try again.');
  } finally {
    setBusy(false);
  }
}

// ---- demos ----
async function loadDemos() {
  const select = $('demo');
  try {
    const res = await fetch('/api/demos');
    if (!res.ok) throw new Error('bad status');
    demos = await res.json();
  } catch {
    $('demo-note').textContent = 'The demonstration list could not be loaded. You can still choose your own files.';
    return;
  }
  for (const d of demos) {
    const opt = el('option', { value: d.id }, d.request ? d.title : `${d.title} (not available)`);
    if (!d.request) opt.disabled = true;
    select.append(opt);
  }
  const missing = demos.filter((d) => !d.request && d.missingReason);
  const note = $('demo-note');
  note.replaceChildren();
  for (const d of missing) note.append(el('span', { class: 'block' }, `${d.title}: ${d.missingReason}`));
}

function onDemoChange() {
  const d = demos.find((x) => x.id === $('demo').value);
  clearProblems();
  if (!d || !d.request) { setStatus(''); return; }
  applyState(stateFromDemo(d));
  const extra = d.label ? ` ${d.label}` : '';
  setStatus(`Loaded the demonstration "${d.title}". You can change any value before running.${extra}`);
}

function init() {
  for (const f of ['burnIn', 'samples', 'thin', 'seed', 'timeoutS', 'chains']) {
    $(`hint-${f}`).textContent = rangeHint(f);
  }
  renderInitsRows();
  $('chains').addEventListener('change', renderInitsRows);
  $('model').addEventListener('change', (ev) => readFile(ev.target, (f) => { state.model = f; refreshInfo('model', f); }));
  $('data').addEventListener('change', (ev) => readFile(ev.target, (f) => { state.data = f; refreshInfo('data', f); }));
  $('demo').addEventListener('change', onDemoChange);
  $('run-form').addEventListener('submit', onSubmit);
  loadDemos();
}

init();

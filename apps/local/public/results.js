// results.js: Results page behaviour (spec 03-local-product, task 5.3). Requirements 8.1 to 8.8.
// DOM glue only. Text rules live in results-logic.js (tested under node:test).
// Everything from the server, including the engine log, is inserted with textContent.
import {
  POLL_MS, isActive, isTerminal, describeState, runIdFromSearch, runUrl, manifestUrl, fileUrl,
  announceState, detailRows, reasonText, firstEngineErrorLine, boundLog, fileRows, summaryView,
  describeFetchFailure,
} from '/results-logic.js';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

let timer = null;
let lastState = null;
let lastFilesKey = '';
let lastSummaryKey = '';

function announce(text) { if (text) $('announce').textContent = text; }

function showProblem(text) {
  $('load-problem-text').textContent = text;
  $('load-problem').hidden = false;
}

function renderState(run) {
  const d = describeState(run.state);
  const badge = $('state-badge');
  badge.textContent = d.word;
  badge.setAttribute('data-tone', d.tone);
  $('state-text').textContent = d.text;
  $('poll-note').hidden = !isActive(run.state);

  const reason = reasonText(run);
  const line = firstEngineErrorLine(run);
  $('reason-box').hidden = reason === '' && line === null;
  $('reason-label').textContent = run.state === 'succeeded' ? 'Runner note' : 'Reason reported by the runner';
  $('reason').textContent = reason;
  $('reason').hidden = reason === '';
  $('engine-line-wrap').hidden = line === null;
  $('engine-line').hidden = line === null;
  $('engine-line').textContent = line ?? '';
}

function renderDetails(run) {
  const dl = $('details');
  dl.replaceChildren();
  for (const [k, v] of detailRows(run)) {
    dl.append(el('dt', {}, k));
    dl.append(el('dd', {}, v));
  }
}

function renderLog(run) {
  const b = boundLog(run.log);
  $('log').textContent = b.lines.join('\n');
  $('log').hidden = b.empty;
  $('log-empty').hidden = !b.empty;
  $('log-note').hidden = b.note === null;
  $('log-note').textContent = b.note ?? '';
}

function renderFiles(run) {
  const rows = fileRows(run);
  const key = JSON.stringify(rows);
  if (key === lastFilesKey) return;
  lastFilesKey = key;
  const body = $('files-body');
  body.replaceChildren();
  for (const r of rows) {
    const tr = el('tr');
    tr.append(el('th', { scope: 'row' }, r.name));
    tr.append(el('td', {}, r.size));
    tr.append(el('td', { class: 'hash' }, r.sha256));
    const td = el('td');
    const a = el('a', { href: fileUrl(run.id, r.name), download: r.name }, 'Download');
    a.setAttribute('aria-label', `Download ${r.name}`);
    td.append(a);
    tr.append(td);
    body.append(tr);
  }
  $('files-wrap').hidden = rows.length === 0;
  $('files-empty').hidden = rows.length !== 0;
}

function renderManifest(run) {
  const ready = isTerminal(run.state);
  $('manifest-wait').hidden = ready;
  $('manifest-link-wrap').hidden = !ready;
  if (ready) $('manifest-link').setAttribute('href', manifestUrl(run.id));
}

function renderSummary(run) {
  const v = summaryView(run);
  const key = JSON.stringify(v);
  if (key === lastSummaryKey) return;
  lastSummaryKey = key;
  $('summary-none').hidden = v.kind !== 'none';
  $('summary-unavailable').hidden = v.kind !== 'unavailable';
  $('summary-table-wrap').hidden = v.kind !== 'table';
  if (v.kind === 'unavailable') {
    $('summary-unavailable').textContent = `${v.message} No summary numbers are shown.`;
  }
  if (v.kind === 'table') {
    $('summary-label').textContent = v.label;
    const head = $('summary-head');
    head.replaceChildren();
    const tr = el('tr');
    for (const h of v.head) tr.append(el('th', { scope: 'col' }, h));
    head.append(tr);
    const body = $('summary-body');
    body.replaceChildren();
    for (const r of v.rows) {
      const row = el('tr');
      r.forEach((cell, i) => row.append(el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}, cell)));
      body.append(row);
    }
  }
}

function render(run) {
  $('load-problem').hidden = true;
  $('run-view').hidden = false;
  renderState(run);
  renderDetails(run);
  renderLog(run);
  renderFiles(run);
  renderManifest(run);
  renderSummary(run);
  announce(announceState(run.state, lastState));
  lastState = run.state;
}

async function poll(id) {
  timer = null;
  let stop = false;
  try {
    const res = await fetch(runUrl(id), { headers: { Accept: 'application/json' } });
    if (res.status === 200) {
      const run = await res.json();
      render(run);
      stop = !isActive(run.state);
    } else {
      showProblem(describeFetchFailure(res.status));
      announce(describeFetchFailure(res.status));
      stop = res.status === 404 || res.status === 403;
    }
  } catch {
    showProblem('The local server could not be reached. This page will keep trying. Check that the server is still running.');
  }
  if (!stop) timer = setTimeout(() => poll(id), POLL_MS);
}

function init() {
  const id = runIdFromSearch(window.location.search);
  if (!id) {
    $('no-run').hidden = false;
    if (window.location.search && /id=/.test(window.location.search)) {
      $('no-run-text').prepend(document.createTextNode('That run address is not valid. '));
    }
    return;
  }
  poll(id);
}

init();

// results.js: Results page behaviour (spec 03-local-product, task 5.3; spec 05-ui-redesign tasks 5 to 7, 12).
// Requirements 8.1 to 8.8 of spec 03. DOM glue only. Text rules live in results-logic.js (tested under node:test).
// Everything from the server, including the engine log, is inserted with textContent.
import {
  POLL_MS, isActive, isTerminal, describeState, runIdFromSearch, runUrl, manifestUrl, fileUrl,
  announceState, detailRows, reasonText, firstEngineErrorLine, boundLog, fileRows, summaryView,
  describeFetchFailure, shortHash, timelineFromLog, runSheetRows, parseCoda, parseTracesCsv,
  histogram, betaPdf, exactBetaFor, SUCCESS_MARKERS,
} from '/results-logic.js';
import { settle, lightStep, countTo, flash, gsapOrNull, ease, DURATION_MS } from '/motion.js';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};
// The SVG namespace is read from the <svg> already in results.html, so this file names no URL.
const svgEl = (tag, attrs = {}, text) => {
  const e = document.createElementNS($('sample-plot-svg').namespaceURI, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
};

let timer = null;
let lastState = null;
let lastFilesKey = '';
let lastSummaryKey = '';
let lastTimelineKey = '';
let lastSheetKey = '';
let plotDrawnFor = null;
let volumeShownFor = null;

function announce(text) { if (text) $('announce').textContent = text; }

function showProblem(text) {
  $('load-problem-text').textContent = text;
  $('load-problem').hidden = false;
}

function renderState(run) {
  const d = describeState(run.state);
  const badge = $('state-badge');
  const changed = badge.textContent !== d.word;
  badge.textContent = d.word;
  badge.setAttribute('data-tone', d.tone);
  if (changed && lastState !== null) flash(badge);
  $('state-text').textContent = d.text;
  $('poll-note').hidden = !isActive(run.state);

  const reason = reasonText(run);
  const line = firstEngineErrorLine(run);
  $('reason-box').hidden = reason === '' && line === null;
  $('reason-box').setAttribute('data-tone', d.tone);
  $('reason-label').textContent = run.state === 'succeeded' ? 'Runner note' : 'Reason reported by the runner';
  $('reason').textContent = reason;
  $('reason').hidden = reason === '';
  $('engine-line-wrap').hidden = line === null;
  $('engine-line').hidden = line === null;
  $('engine-line').textContent = line ?? '';
}

function renderSheet(run) {
  const rows = runSheetRows(run);
  const key = JSON.stringify(rows);
  if (key === lastSheetKey) return;
  lastSheetKey = key;
  const dl = $('run-sheet');
  dl.replaceChildren();
  for (const [k, v] of rows) {
    const box = el('div');
    box.append(el('dt', {}, k), el('dd', {}, v));
    dl.append(box);
  }
}

function renderTimeline(run) {
  const t = timelineFromLog(run);
  const key = JSON.stringify(t);
  if (key === lastTimelineKey) return;
  const before = lastTimelineKey ? JSON.parse(lastTimelineKey).steps.map((s) => s.status) : [];
  lastTimelineKey = key;
  $('timeline-wrap').hidden = false;
  const ol = $('timeline');
  ol.classList.toggle('is-coarse', t.kind === 'coarse');
  $('timeline-note').textContent = t.kind === 'markers'
    ? `A step is marked done only when its line appears in the engine log. These are the ${SUCCESS_MARKERS.length} lines the runner requires, in order.`
    : 'Coarse steps for a built-in fixture, taken from the run state and the collected files.';
  ol.replaceChildren();
  const lit = [];
  t.steps.forEach((s, i) => {
    const li = el('li', { 'data-step': s.status });
    li.append(el('span', { class: 'step-label' }, s.label), el('span', { class: 'step-state' }, s.word));
    ol.append(li);
    if (s.status !== 'pending' && before[i] !== s.status) lit.push(li);
  });
  lit.forEach((li, i) => setTimeout(() => lightStep(li), i * 60));
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

function copyHash(name, sha) {
  const done = (ok) => {
    $('copy-status').textContent = ok ? `Copied the SHA-256 of ${name}.` : `Copy is not available here. The SHA-256 of ${name} is ${sha}.`;
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(sha).then(() => done(true), () => done(false));
  else done(false);
}

function renderFiles(run) {
  const rows = fileRows(run);
  const key = JSON.stringify(rows);
  if (key === lastFilesKey) return;
  lastFilesKey = key;
  const body = $('files-body');
  body.replaceChildren();
  const tags = [];
  for (const r of rows) {
    const tr = el('tr');
    tr.append(el('th', { scope: 'row' }, r.name));
    tr.append(el('td', {}, r.size));
    const td = el('td', { class: 'hash' });
    const h = shortHash(r.sha256);
    if (h) {
      const tag = el('span', { class: 'hash-tag', title: `SHA-256 of ${r.name}` });
      tag.append(el('span', { class: 'hash-text' }, h.full));
      td.append(tag);
      tags.push(tag);
    } else {
      td.textContent = r.sha256;
    }
    tr.append(td);
    const actions = el('td');
    const a = el('a', { href: fileUrl(run.id, r.name), download: r.name }, 'Download');
    a.setAttribute('aria-label', `Download ${r.name}`);
    actions.append(a);
    if (h) {
      const b = el('button', { type: 'button', class: 'text-button', 'aria-label': `Copy the SHA-256 of ${r.name}` }, 'Copy hash');
      b.addEventListener('click', () => { copyHash(r.name, h.full); flash(b); });
      actions.append(' ', b);
    }
    tr.append(actions);
    body.append(tr);
  }
  $('files-wrap').hidden = rows.length === 0;
  $('files-empty').hidden = rows.length !== 0;
  settle(tags);
}

function renderManifest(run) {
  const ready = isTerminal(run.state);
  $('manifest-wait').hidden = ready;
  $('manifest-link-wrap').hidden = !ready;
  $('bundle-links').hidden = !ready;
  if (ready) {
    $('manifest-link').setAttribute('href', manifestUrl(run.id));
    const bundle = `${runUrl(run.id)}/bundle`;
    $('bundle-output').href = bundle;
    $('bundle-metadata').href = `${bundle}?mode=metadata`;
    $('bundle-input-wrap').hidden = run.engine !== 'openbugs';
    $('bundle-input').href = `${bundle}?mode=inputs`;
  }
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
    v.head.forEach((h, i) => tr.append(el('th', i === 0 ? { scope: 'col' } : { scope: 'col', class: 'num' }, h)));
    head.append(tr);
    const body = $('summary-body');
    body.replaceChildren();
    for (const r of v.rows) {
      const row = el('tr');
      r.forEach((cell, i) => {
        const c = el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : { class: 'num' });
        row.append(c);
        countTo(c, cell);
      });
      body.append(row);
    }
  }
}

// ---- moment 2: the plot of exported samples ----
async function loadSamples(run) {
  const names = new Set((run.files ?? []).map((f) => f.name));
  const text = async (name) => {
    const res = await fetch(fileUrl(run.id, name));
    if (!res.ok) throw new Error(`could not read ${name}`);
    return res.text();
  };
  if (names.has('coda_CODAindex.txt')) {
    const chainNames = [1, 2, 3, 4].map((n) => `coda_CODAchain${n}.txt`).filter((n) => names.has(n));
    if (chainNames.length === 0) return null;
    const [index, ...chains] = await Promise.all([text('coda_CODAindex.txt'), ...chainNames.map(text)]);
    return { source: 'CODA files written by the engine', ...parseCoda(index, chains) };
  }
  if (names.has('traces.csv')) return { source: 'traces.csv written by PyMC 2', ...parseTracesCsv(await text('traces.csv')) };
  return null;
}

function drawPlot(node, source, beta) {
  const W = 560; const H = 280; const m = { l: 44, r: 16, t: 16, b: 36 };
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const range = beta ? [0, 1] : null;
  const h = histogram(node.chains, 40, range);
  let yMax = h.peak;
  const curve = [];
  if (beta) {
    for (let i = 0; i <= 120; i += 1) {
      const x = h.min + ((h.max - h.min) * i) / 120;
      const y = betaPdf(x, beta.a, beta.b);
      if (Number.isFinite(y)) { curve.push([x, y]); if (y > yMax) yMax = y; }
    }
  }
  yMax *= 1.08;
  const sx = (x) => m.l + ((x - h.min) / (h.max - h.min)) * iw;
  const sy = (y) => m.t + ih - (y / yMax) * ih;
  const svg = $('sample-plot-svg');
  const n = node.chains.reduce((a, c) => a + c.length, 0);
  svg.replaceChildren();
  svg.append(svgEl('title', { id: 'sample-plot-title' }, `Histogram of ${node.name}`));
  svg.append(svgEl('desc', { id: 'sample-plot-desc' }, `${n} exported samples of ${node.name} from ${node.chains.length} chain${node.chains.length === 1 ? '' : 's'}, read from the ${source}.${beta ? ` The line is the exact Beta(${beta.a}, ${beta.b}) density of this toy model.` : ''}`));
  const grid = svgEl('g', { class: 'grid' });
  for (let i = 1; i <= 4; i += 1) { const y = m.t + (ih * i) / 4; grid.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y })); }
  svg.append(grid);
  const bars = svgEl('g', { class: 'bars' });
  const k = node.chains.length;
  const bw = iw / h.bins;
  const drawn = [];
  h.density.forEach((dens, ci) => {
    dens.forEach((d, bi) => {
      if (d <= 0) return;
      const x = m.l + bi * bw + (ci * bw) / k + 0.5;
      const y = sy(d);
      const r = svgEl('rect', { class: ci === 0 ? 'bar-a' : 'bar-b', x: x.toFixed(2), y: y.toFixed(2), width: Math.max(0.5, bw / k - 1).toFixed(2), height: (m.t + ih - y).toFixed(2) });
      bars.append(r);
      drawn.push(r);
    });
  });
  svg.append(bars);
  let path = null;
  if (curve.length > 1) {
    path = svgEl('path', { class: 'exact', d: curve.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`).join(' ') });
    svg.append(path);
  }
  const axis = svgEl('g', { class: 'axis' });
  axis.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih }));
  for (let i = 0; i <= 4; i += 1) {
    const v = h.min + ((h.max - h.min) * i) / 4;
    const x = sx(v);
    axis.append(svgEl('line', { x1: x, x2: x, y1: m.t + ih, y2: m.t + ih + 4 }));
    axis.append(svgEl('text', { x, y: H - 14, 'text-anchor': 'middle' }, v.toFixed(2)));
  }
  axis.append(svgEl('text', { x: m.l, y: H - 1, 'text-anchor': 'start' }, node.name));
  axis.append(svgEl('text', { x: m.l - 8, y: m.t + 10, 'text-anchor': 'end' }, 'density'));
  svg.append(axis);

  const legend = $('sample-plot-legend');
  legend.replaceChildren();
  node.chains.forEach((c, i) => {
    const li = el('li');
    li.append(el('span', { class: `key ${i === 0 ? 'key-a' : ''}`.trim(), 'aria-hidden': 'true' }), `Chain ${i + 1}, ${c.length} samples`);
    legend.append(li);
  });
  if (beta) {
    const li = el('li');
    li.append(el('span', { class: 'key key-line', 'aria-hidden': 'true' }), `Exact posterior for this toy model, Beta(${beta.a}, ${beta.b})`);
    legend.append(li);
  }
  $('sample-plot').hidden = false;

  const gsap = gsapOrNull();
  if (gsap) {
    gsap.from(drawn, { scaleY: 0, transformOrigin: '50% 100%', duration: DURATION_MS.enter / 1000, ease, stagger: { amount: 0.24 }, clearProps: 'transform' });
    if (path) {
      const len = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.6, ease, delay: 0.12, clearProps: 'strokeDasharray,strokeDashoffset' });
    }
  }
}

async function renderPlot(run) {
  if (run.state !== 'succeeded' || plotDrawnFor === run.id) return;
  if (!['openbugs', 'pymc2', undefined].includes(run.engine)) return;
  plotDrawnFor = run.id;
  try {
    const samples = await loadSamples(run);
    const node = samples?.nodes?.[0];
    if (!node) return;
    drawPlot(node, samples.source, exactBetaFor(run));
  } catch {
    $('sample-plot').hidden = true;
  }
}

// ---- NiftyNet volume viewer (three.js, loaded only for this case) ----
async function renderVolume(run) {
  if (run.engine !== 'niftynet' || run.state !== 'succeeded' || volumeShownFor === run.id) return;
  if (!run.files.some((f) => f.name === 'volume.npy')) return;
  volumeShownFor = run.id;
  try {
    const { mountVolumeViewer } = await import('/volume-viewer.js');
    const res = await fetch(fileUrl(run.id, 'volume.npy'));
    if (!res.ok) return;
    await mountVolumeViewer({ buffer: await res.arrayBuffer(), stage: $('volume-stage'), range: $('volume-slice'), wrap: $('volume-viewer') });
  } catch {
    $('volume-viewer').hidden = true;
  }
}

function render(run) {
  $('load-problem').hidden = true;
  $('run-view').hidden = false;
  renderState(run);
  renderSheet(run);
  renderTimeline(run);
  renderDetails(run);
  renderLog(run);
  renderFiles(run);
  renderManifest(run);
  renderSummary(run);
  $('fixture-results').hidden = !run.comparison;
  $('fixture-heading').textContent = run.engine === 'openbugs' || run.engine === undefined
    ? 'Comparison with the known answer of this toy model' : 'Fixture comparison';
  if (run.comparison) $('fixture-values').textContent = JSON.stringify(run.comparison, null, 2);
  $('cancel-run').hidden = !isActive(run.state);
  if ($('slice-preview').hidden && run.engine === 'niftynet' && run.files.some((file) => file.name === 'slice.png')) {
    $('slice-preview').src = `${fileUrl(run.id, 'slice.png')}?preview=1`;
    $('slice-preview').hidden = false;
  }
  void renderPlot(run);
  void renderVolume(run);
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
  $('cancel-run').addEventListener('click', async () => {
    $('cancel-run').disabled = true;
    try {
      const response = await fetch(`${runUrl(id)}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      $('cancel-status').textContent = response.ok ? 'Cancellation requested.' : 'This run is no longer active.';
    } catch {
      $('cancel-status').textContent = 'Could not request cancellation. Try again.';
      $('cancel-run').disabled = false;
    }
  });
  poll(id);
}

init();

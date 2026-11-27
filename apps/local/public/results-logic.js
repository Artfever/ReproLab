// results-logic.js: DOM-free helpers for the Results page (spec 03-local-product, task 5.3).
// Requirements 8.1 to 8.8. Runs in the browser and under node:test.
// Everything here returns plain strings or data. The DOM glue in results.js inserts them with
// textContent only.

export const LOG_MAX_LINES = 2000;
export const LOG_MAX_BYTES = 262144;
export const POLL_MS = 1500; // Requirement 8.7: 1 to 2 seconds.
export const POLL_MIN_MS = 1000;
export const POLL_MAX_MS = 2000;
export const SUMMARY_LABEL = 'Computed by ReproLab from the exported samples. Not a convergence or validity claim.';
export const ACTIVE_STATES = Object.freeze(['queued', 'running']);
export const TERMINAL_STATES = Object.freeze(['succeeded', 'engine_error', 'timed_out', 'runner_error', 'cancelled', 'interrupted']);

// Copy of the engine-problem patterns in services/runner/reprolab_runner/adapter.py
// (ENGINE_ERROR_PATTERNS). Used only to point at the first matching line in the log.
// The log line itself is shown unchanged.
const ENGINE_ERROR_LINE = [/error pos \d+/, /\bis not defined\b/, /^model must /, /unknown script command/];

const STATES = Object.freeze({
  queued: { word: 'Queued', text: 'The run is waiting to start.', tone: 'wait' },
  running: { word: 'Running', text: 'The engine is running in a container on this computer.', tone: 'wait' },
  succeeded: { word: 'Succeeded', text: 'The engine finished and wrote its expected files. This is not a statement that the result is scientifically valid.', tone: 'ok' },
  engine_error: { word: 'Engine error', text: 'The engine reported a problem with the model, data or initial values. See the engine message and log below.', tone: 'bad' },
  timed_out: { word: 'Timed out', text: 'The run reached its time limit and was stopped. No result is available.', tone: 'bad' },
  runner_error: { word: 'Runner error', text: 'The run could not be completed because of a problem outside the model. See the reason below.', tone: 'bad' },
  cancelled: { word: 'Cancelled', text: 'The user stopped this run. Any collected partial files are listed below.', tone: 'bad' },
  interrupted: { word: 'Interrupted', text: 'The server stopped during this run. Start another run to try again.', tone: 'bad' },
});

export const isActive = (state) => ACTIVE_STATES.includes(state);
export const isTerminal = (state) => TERMINAL_STATES.includes(state);

/** Visible word, explanation and tone for a state. Unknown states are shown as a runner error. */
export function describeState(state) {
  return STATES[state] ?? { word: 'Unknown state', text: 'The local server reported a state this page does not recognise.', tone: 'bad' };
}

/** The Run_Id from a location.search string, or null when it is absent or malformed. */
export function runIdFromSearch(search) {
  const m = /^\??(?:.*&)?id=([^&]*)/.exec(String(search ?? ''));
  if (!m) return null;
  let v;
  try { v = decodeURIComponent(m[1]); } catch { return null; }
  return /^[0-9a-f]{32}$/.test(v) ? v : null;
}

export const runUrl = (id) => `/api/runs/${encodeURIComponent(id)}`;
export const manifestUrl = (id) => `/api/runs/${encodeURIComponent(id)}/manifest`;
export const fileUrl = (id, name) => `/api/runs/${encodeURIComponent(id)}/files/${encodeURIComponent(name)}`;

/** Text announced in the live region when the state changes (or on first load). */
export function announceState(state, previous) {
  const d = describeState(state);
  if (previous === undefined || previous === null) return `Run state: ${d.word}.`;
  if (previous === state) return null;
  return `Run state changed from ${describeState(previous).word} to ${d.word}.`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size';
  if (bytes === 1) return '1 byte';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1048576).toFixed(2)} MiB`;
}

export function formatRuntime(s) {
  if (typeof s !== 'number' || !Number.isFinite(s)) return 'not reported';
  return `${s} s`;
}

/** Label/value rows for the details list. Values are plain strings. */
export function detailRows(run) {
  const s = run.settings ?? {};
  if (run.engine && run.engine !== 'openbugs') return [
    ['Engine', run.engine], ['Engine version', run.engineVersion ?? 'not reported'],
    ['Workflow', run.workflow], ['Fixture', s.case], ['Runtime', formatRuntime(run.runtimeS)],
  ];
  const list = (v) => (Array.isArray(v) ? v.join(', ') : 'not reported');
  const num = (v) => (Number.isFinite(v) ? String(v) : 'not reported');
  return [
    ['Run state', describeState(run.state).word],
    ['Engine version', typeof run.engineVersion === 'string' && run.engineVersion ? run.engineVersion : 'not reported'],
    ['Runtime', formatRuntime(run.runtimeS)],
    ['Chains', num(s.chains)],
    ['Burn-in', num(s.burnIn)],
    ['Samples', num(s.samples)],
    ['Thin', num(s.thin)],
    ['Seed', num(s.seed)],
    ['Time limit (seconds)', num(s.timeoutS)],
    ['Monitors', list(s.monitors)],
    ['Created', typeof run.createdAt === 'string' ? run.createdAt : 'not reported'],
  ];
}

/** Reason text, or '' when none. */
export function reasonText(run) {
  return typeof run.reason === 'string' ? run.reason : '';
}

/** First engine problem line in the log, or null. Only used when the state is engine_error. */
export function firstEngineErrorLine(run) {
  if (run.state !== 'engine_error') return null;
  const lines = Array.isArray(run.log?.lines) ? run.log.lines : [];
  const hit = lines.find((l) => typeof l === 'string' && ENGINE_ERROR_LINE.some((re) => re.test(l)));
  return hit ?? null;
}

/**
 * Log lines to show, bounded to LOG_MAX_LINES lines and LOG_MAX_BYTES bytes, plus a note.
 * The server already bounds the log; this guards the page against a larger response.
 * @returns {{lines: string[], note: string|null, empty: boolean}}
 */
export function boundLog(log) {
  const raw = Array.isArray(log?.lines) ? log.lines.map((l) => String(l)) : [];
  let truncated = log?.truncated === true;
  let lines = raw;
  if (lines.length > LOG_MAX_LINES) { lines = lines.slice(0, LOG_MAX_LINES); truncated = true; }
  let bytes = 0;
  const kept = [];
  const enc = new TextEncoder();
  for (const l of lines) {
    bytes += enc.encode(l).length + 1;
    if (bytes > LOG_MAX_BYTES) { truncated = true; break; }
    kept.push(l);
  }
  const note = truncated
    ? `The log is longer than this page shows. Only the first ${LOG_MAX_LINES} lines or ${LOG_MAX_BYTES / 1024} KiB are displayed (${kept.length} lines shown). The rest was not loaded.`
    : null;
  return { lines: kept, note, empty: kept.length === 0 };
}

/** One row per output file. */
export function fileRows(run) {
  const files = Array.isArray(run.files) ? run.files : [];
  return files
    .filter((f) => f && typeof f.name === 'string')
    .map((f) => ({
      name: f.name,
      size: formatBytes(f.bytes),
      sha256: typeof f.sha256 === 'string' ? f.sha256 : 'not reported',
    }));
}

/**
 * What to show for the summary.
 * @returns {{kind:'none'|'unavailable'|'table', label?:string, message?:string, rows?:string[][], head?:string[]}}
 */
export function summaryView(run) {
  if (run.state !== 'succeeded') return { kind: 'none' };
  const s = run.summary;
  if (!s || typeof s !== 'object') return { kind: 'unavailable', message: 'No summary was computed for this run.' };
  if (s.available !== true) {
    return { kind: 'unavailable', message: typeof s.reason === 'string' && s.reason ? s.reason : 'The summary could not be computed.' };
  }
  const nodes = s.nodes && typeof s.nodes === 'object' && !Array.isArray(s.nodes) ? s.nodes : {};
  const names = Object.keys(nodes).sort();
  if (names.length === 0) return { kind: 'unavailable', message: 'The summary contained no variables.' };
  const cols = ['mean', 'sd', 'median', 'q2.5', 'q97.5', 'n'];
  const fmt = (v) => (typeof v === 'number' && Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toPrecision(4)) : 'n/a');
  return {
    kind: 'table',
    label: SUMMARY_LABEL, // always the fixed sentence, never text from the response
    head: ['Variable', 'Mean', 'SD', 'Median', '2.5%', '97.5%', 'Samples'],
    rows: names.map((n) => [n, ...cols.map((c) => fmt(nodes[n]?.[c]))]),
  };
}

// ---------------------------------------------------------------------------------------------
// Spec 05-ui-redesign additions. Everything below is DOM-free and covered by node:test.
// ---------------------------------------------------------------------------------------------

/** The hash tag signature: { algo, short, full } for a 64-hex SHA-256, or null. */
export function shortHash(sha) {
  if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) return null;
  return { algo: 'sha256', short: `${sha.slice(0, 8)}…`, full: sha };
}

// Copy of REQUIRED_SUCCESS_MARKERS in services/runner/reprolab_runner/adapter.py. A test reads the
// Python tuple and checks this list is equal and in the same order.
export const SUCCESS_MARKERS = Object.freeze([
  'model is syntactically correct',
  'data loaded',
  'model compiled',
  'model is initialized',
  'updates took',
  'Node statistics',
  'CODA files written',
]);
export const COARSE_STEPS = Object.freeze(['Container started', 'Engine finished', 'Files collected']);
const STOPPED_STATES = ['engine_error', 'timed_out', 'runner_error', 'cancelled', 'interrupted'];
const STEP_WORD = { done: 'Done', failed: 'Stopped here', active: 'Waiting', pending: 'Not reached' };

/**
 * Timeline of a run. OpenBUGS: the seven success markers, found in order in the log text with
 * the same rule as classify() in adapter.py (each search starts where the previous marker ended).
 * A step is 'done' only when its line is in the log. Fixture engines get three coarse steps from
 * the run state and file list. Returns { kind, steps: [{label, status, word}] }.
 */
export function timelineFromLog(run) {
  const state = run?.state;
  const engine = run?.engine ?? 'openbugs';
  const stopped = STOPPED_STATES.includes(state) || !(isActive(state) || state === 'succeeded');
  if (engine === 'openbugs') {
    const lines = Array.isArray(run?.log?.lines) ? run.log.lines.map((l) => String(l)) : [];
    const text = lines.join('\n');
    let pos = 0;
    const done = SUCCESS_MARKERS.map((m) => {
      const at = pos < 0 ? -1 : text.indexOf(m, pos);
      if (at < 0) { pos = -1; return false; }
      pos = at + m.length;
      return true;
    });
    const firstMissing = done.indexOf(false);
    const steps = SUCCESS_MARKERS.map((label, i) => {
      let status = done[i] ? 'done' : 'pending';
      // A succeeded run always has every marker unless the log shown here was truncated, so a
      // missing marker on success stays 'pending' rather than being shown as the failure point.
      if (!done[i] && i === firstMissing) status = isActive(state) ? 'active' : (stopped ? 'failed' : 'pending');
      return { label, status, word: STEP_WORD[status] };
    });
    return { kind: 'markers', steps };
  }
  const files = Array.isArray(run?.files) ? run.files.length : 0;
  let st;
  if (state === 'queued') st = ['active', 'pending', 'pending'];
  else if (state === 'running') st = ['done', 'active', 'pending'];
  else if (state === 'succeeded') st = ['done', 'done', files > 0 ? 'done' : 'failed'];
  else if (STOPPED_STATES.includes(state)) st = ['done', 'failed', 'pending'];
  else st = ['failed', 'pending', 'pending'];
  return { kind: 'coarse', steps: COARSE_STEPS.map((label, i) => ({ label, status: st[i], word: STEP_WORD[st[i]] })) };
}

/** Label/value pairs for the run sheet at the top of Results. Execution and comparison stay separate. */
export function runSheetRows(run) {
  const engineName = run?.engine && run.engine !== 'openbugs' ? run.engine : 'OpenBUGS';
  const version = typeof run?.engineVersion === 'string' && run.engineVersion ? run.engineVersion : 'not reported';
  const c = run?.comparison;
  let comparison = 'none for this run';
  if (c && (c.status === 'passed' || c.status === 'failed')) {
    const tol = Number.isFinite(c.absoluteTolerance) ? `, tolerance ${c.absoluteTolerance}` : '';
    comparison = `${c.status === 'passed' ? 'passed' : 'failed'} against fixed expected values${tol}`;
  }
  return [
    ['Engine', `${engineName} ${version}`],
    ['Runtime', formatRuntime(run?.runtimeS)],
    ['Comparison', comparison],
    ['Created', typeof run?.createdAt === 'string' ? run.createdAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'not reported'],
  ];
}

export const CODA_MAX_VALUES = 200000;
export const CODA_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Parse CODA output. index: lines "name first last"; chains: one text per chain with lines
 * "iteration value". Returns { nodes: [{ name, chains: number[][] }] } or throws on anything else.
 */
export function parseCoda(indexText, chainTexts) {
  if (typeof indexText !== 'string' || !Array.isArray(chainTexts) || chainTexts.length < 1 || chainTexts.length > 4) throw new Error('CODA input is not usable.');
  const bytes = indexText.length + chainTexts.reduce((n, t) => n + (typeof t === 'string' ? t.length : Infinity), 0);
  if (!(bytes <= CODA_MAX_BYTES)) throw new Error('CODA files are too large to plot.');
  const index = [];
  for (const raw of indexText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-Za-z][A-Za-z0-9_.[\],]*)\s+(\d+)\s+(\d+)$/.exec(line);
    if (!m) throw new Error('CODA index line not understood.');
    const first = Number(m[2]); const last = Number(m[3]);
    if (first < 1 || last < first) throw new Error('CODA index range not valid.');
    index.push({ name: m[1], first, last });
    if (index.length > 25) throw new Error('Too many CODA nodes to plot.');
  }
  if (index.length === 0) throw new Error('CODA index is empty.');
  const total = index.reduce((n, x) => n + (x.last - x.first + 1), 0) * chainTexts.length;
  if (total > CODA_MAX_VALUES) throw new Error('Too many samples to plot.');
  const chains = chainTexts.map((t) => {
    const vals = [];
    for (const raw of t.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = /^(\d+)\s+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/.exec(line);
      if (!m) throw new Error('CODA chain line not understood.');
      vals.push(Number(m[2]));
    }
    return vals;
  });
  const nodes = index.map(({ name, first, last }) => ({
    name,
    chains: chains.map((vals) => {
      if (vals.length < last) throw new Error('CODA chain is shorter than its index.');
      return vals.slice(first - 1, last);
    }),
  }));
  return { nodes };
}

/** Parse PyMC 2's traces.csv ("chain,draw,p" header). Returns { nodes: [{ name, chains }] }. */
export function parseTracesCsv(text) {
  if (typeof text !== 'string' || text.length > CODA_MAX_BYTES) throw new Error('Trace file is not usable.');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = (lines.shift() ?? '').split(',').map((s) => s.trim());
  if (head.length !== 3 || head[0] !== 'chain' || head[1] !== 'draw' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(head[2])) throw new Error('Trace header not understood.');
  if (lines.length > CODA_MAX_VALUES) throw new Error('Too many samples to plot.');
  const byChain = new Map();
  for (const l of lines) {
    const [c, d, v] = l.split(',');
    if (!/^\d+$/.test(c ?? '') || !/^\d+$/.test(d ?? '') || !Number.isFinite(Number(v))) throw new Error('Trace line not understood.');
    if (!byChain.has(c)) byChain.set(c, []);
    byChain.get(c).push(Number(v));
    if (byChain.size > 4) throw new Error('Too many chains to plot.');
  }
  return { nodes: [{ name: head[2], chains: [...byChain.keys()].sort().map((k) => byChain.get(k)) }] };
}

/**
 * Histogram of several series over one shared range. Returns { min, max, width, counts: number[][], peak }.
 * Densities are counts / (n * width), so a density curve can be drawn on the same scale.
 */
export function histogram(series, bins = 40, range = null) {
  if (!Array.isArray(series) || series.length === 0) throw new Error('No samples.');
  const nb = Math.max(4, Math.min(200, Math.floor(bins)));
  let min = Infinity; let max = -Infinity;
  for (const s of series) for (const v of s) { if (!Number.isFinite(v)) throw new Error('Sample is not a number.'); if (v < min) min = v; if (v > max) max = v; }
  if (range) { min = range[0]; max = range[1]; }
  if (!(max > min)) { max = min + 1; }
  const width = (max - min) / nb;
  const counts = series.map((s) => {
    const c = new Array(nb).fill(0);
    for (const v of s) {
      if (v < min || v > max) continue;
      c[Math.min(nb - 1, Math.floor((v - min) / width))] += 1;
    }
    return c;
  });
  const density = counts.map((c, i) => c.map((k) => k / (series[i].length * width)));
  const peak = Math.max(...density.flat());
  return { min, max, width, bins: nb, counts, density, peak };
}

function logGamma(z) {
  // Lanczos approximation, g = 7, n = 9.
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const x = z - 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Density of Beta(a, b) at x. */
export function betaPdf(x, a, b) {
  if (!(a > 0 && b > 0) || !(x >= 0 && x <= 1)) return 0;
  if ((x === 0 && a < 1) || (x === 1 && b < 1)) return Infinity;
  if (x === 0 || x === 1) return 0;
  const lnB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnB);
}

/**
 * Beta(a, b) parameters implied by the comparison's expected mean and sd, or null.
 * Only the Coin toy model (OpenBUGS or PyMC 2) carries such a comparison.
 */
export function exactBetaFor(run) {
  if (!['openbugs', 'pymc2', undefined].includes(run?.engine)) return null;
  const e = run?.comparison?.expected;
  if (!e || !Number.isFinite(e.mean) || !Number.isFinite(e.sd) || e.mean <= 0 || e.mean >= 1 || e.sd <= 0) return null;
  const k = (e.mean * (1 - e.mean)) / (e.sd * e.sd) - 1;
  if (!(k > 0)) return null;
  const a = Math.round(e.mean * k * 1e6) / 1e6;
  const b = Math.round((1 - e.mean) * k * 1e6) / 1e6;
  return { a, b };
}

export const NPY_MAX_BYTES = 8 * 1024 * 1024;
const NPY_TYPES = { '<f4': [4, 'getFloat32'], '<f8': [8, 'getFloat64'], '<i4': [4, 'getInt32'], '<i8': [8, 'getBigInt64'], '|u1': [1, 'getUint8'], '<u1': [1, 'getUint8'], '|i1': [1, 'getInt8'], '<i2': [2, 'getInt16'], '<u2': [2, 'getUint16'] };

/** Parse a NumPy .npy file (format 1.0 to 3.0), little-endian numeric, C order. Returns { shape, data }. */
export function parseNpy(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength > NPY_MAX_BYTES) throw new Error('The volume file is not usable.');
  const u8 = new Uint8Array(buffer);
  const magic = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59];
  if (!magic.every((b, i) => u8[i] === b)) throw new Error('Not a NumPy file.');
  const major = u8[6];
  if (major < 1 || major > 3) throw new Error('Unsupported NumPy format version.');
  const view = new DataView(buffer);
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const start = major === 1 ? 10 : 12;
  if (start + headerLen > buffer.byteLength || headerLen > 4096) throw new Error('NumPy header is not valid.');
  const header = new TextDecoder('latin1').decode(u8.subarray(start, start + headerLen));
  const descr = /'descr':\s*'([<|>]?[a-z]\d+)'/.exec(header)?.[1];
  const fortran = /'fortran_order':\s*(True|False)/.exec(header)?.[1];
  const shapeText = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1];
  if (!descr || !fortran || shapeText === undefined) throw new Error('NumPy header is not valid.');
  if (fortran !== 'False') throw new Error('Only C-ordered volumes can be shown.');
  const type = NPY_TYPES[descr];
  if (!type) throw new Error(`NumPy type ${descr} is not supported.`);
  const shape = shapeText.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  if (shape.length < 1 || shape.length > 4 || !shape.every((n) => Number.isInteger(n) && n > 0)) throw new Error('NumPy shape is not valid.');
  const count = shape.reduce((a, b) => a * b, 1);
  const [size, getter] = type;
  const offset = start + headerLen;
  if (offset + count * size > buffer.byteLength) throw new Error('NumPy data is shorter than its shape.');
  const data = new Float64Array(count);
  for (let i = 0; i < count; i += 1) data[i] = Number(view[getter](offset + i * size, true));
  return { shape, data };
}

/** One 2D slice [rows][cols] of a 3D volume along axis 0, plus the volume's min and max. */
export function volumeSlice(vol, index) {
  const [d, h, w] = vol.shape.length === 3 ? vol.shape : [1, ...vol.shape.slice(-2)];
  const k = Math.max(0, Math.min(d - 1, Math.floor(index)));
  let min = Infinity; let max = -Infinity;
  for (const v of vol.data) { if (v < min) min = v; if (v > max) max = v; }
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    const row = [];
    for (let x = 0; x < w; x += 1) row.push(vol.data[k * h * w + y * w + x]);
    rows.push(row);
  }
  return { depth: d, index: k, rows, min, max };
}

/** Plain-English message when the run cannot be fetched. */
export function describeFetchFailure(status) {
  if (status === 404) return 'This run was not found. It may have been removed, or the address is wrong.';
  if (status === 403) return 'The local server refused the request. Open this page from the address that the start script printed.';
  if (status >= 500) return 'The local server hit an error. Check the terminal where it is running.';
  return `The local server answered with status ${status}.`;
}

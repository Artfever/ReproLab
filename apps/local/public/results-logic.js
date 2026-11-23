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

/** Plain-English message when the run cannot be fetched. */
export function describeFetchFailure(status) {
  if (status === 404) return 'This run was not found. It may have been removed, or the address is wrong.';
  if (status === 403) return 'The local server refused the request. Open this page from the address that the start script printed.';
  if (status >= 500) return 'The local server hit an error. Check the terminal where it is running.';
  return `The local server answered with status ${status}.`;
}

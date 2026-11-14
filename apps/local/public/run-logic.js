// run-logic.js: DOM-free helpers for the Run page (spec 03-local-product, task 5.2).
// Requirements 4.7, 4.8, 11.1 to 11.5. Runs in the browser and under node:test.
//
// LIMITS and the size or pattern constants below are a copy of apps/local/src/validate.mjs
// (the browser cannot import from src/). tests/ui-logic.test.mjs asserts they are equal.
// The server remains the authority; these checks only give early messages.

export const LIMITS = Object.freeze({
  chains: Object.freeze({ min: 1, max: 4 }),
  burnIn: Object.freeze({ min: 0, max: 50000 }),
  samples: Object.freeze({ min: 1, max: 50000 }),
  thin: Object.freeze({ min: 1, max: 100 }),
  seed: Object.freeze({ min: 1, max: 14 }),
  timeoutS: Object.freeze({ min: 1, max: 300 }),
  monitors: Object.freeze({ min: 1, max: 25 }),
});
export const MAX_MODEL_BYTES = 262144;
export const MAX_DATA_BYTES = 2097152;
export const NODE_RE_SOURCE = '^[A-Za-z][A-Za-z0-9_.]{0,63}$';
export const ASCII_RE_SOURCE = '^[\\x09\\x0A\\x0D\\x20-\\x7E]*$';
const NODE_RE = new RegExp(NODE_RE_SOURCE);
const ASCII_RE = new RegExp(ASCII_RE_SOURCE);

export const NUMBER_FIELDS = Object.freeze([
  { field: 'burnIn', label: 'Burn-in' },
  { field: 'samples', label: 'Samples' },
  { field: 'thin', label: 'Thin' },
  { field: 'seed', label: 'Seed' },
  { field: 'timeoutS', label: 'Time limit (seconds)' },
]);

export const rangeHint = (field) => `Whole number from ${LIMITS[field].min} to ${LIMITS[field].max}.`;

export function byteLength(text) {
  return new TextEncoder().encode(String(text)).length;
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 bytes';
  if (bytes === 1) return '1 byte';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1048576).toFixed(2)} MiB`;
}

/** Split monitors text on commas and whitespace; drops empty pieces. */
export function parseMonitors(text) {
  return String(text ?? '').split(/[\s,]+/).filter((s) => s.length > 0);
}

/** Strict whole-number parse of a text box value. Returns a number, or null when not a whole number. */
export function parseWhole(text) {
  const s = String(text ?? '').trim();
  return /^[+-]?\d{1,15}$/.test(s) ? Number(s) : null;
}

function checkRange(field, label, raw) {
  const { min, max } = LIMITS[field];
  const s = String(raw ?? '').trim();
  if (s === '') return { message: `${label} is required. Enter a whole number from ${min} to ${max}.` };
  const v = parseWhole(s);
  if (v === null) return { message: `${label} must be a whole number from ${min} to ${max}.` };
  if (v < min || v > max) return { message: `${label} must be from ${min} to ${max}, but it is ${v}.` };
  return { value: v };
}

/** Check one file text. `file` is {name, text} or null. Returns a message or null. */
export function checkFileText(label, file, maxBytes) {
  if (!file || typeof file.text !== 'string') return `${label} is required. Choose a file.`;
  if (file.text.includes('\0')) return `${label} contains a NUL character. Remove it and try again.`;
  if (!ASCII_RE.test(file.text)) {
    return `${label} must be plain ASCII text. Remove accented, non-English or other special characters.`;
  }
  const bytes = byteLength(file.text);
  if (bytes === 0) return `${label} is empty. Add the file contents.`;
  if (bytes > maxBytes) return `${label} is ${bytes} bytes, which is over the limit of ${maxBytes} bytes.`;
  return null;
}

/** Control id on the page for a field name from this module or from the server's problem list. */
export function controlIdFor(field) {
  const f = String(field ?? '');
  let m = /^inits\[(\d+)\]$/.exec(f);
  if (m) return `inits-${Number(m[1]) + 1}`;
  if (f === 'inits' || f === 'names.inits') return 'inits-1';
  if (/^monitors(\[\d+\])?$/.test(f)) return 'monitors';
  if (f === 'model' || f === 'data' || f === 'chains') return f;
  if (f === 'names.model') return 'model';
  if (f === 'names.data') return 'data';
  m = /^(burnIn|samples|thin|seed|timeoutS)$/.exec(f);
  if (m) return m[1];
  return null;
}

/**
 * Validate the form state before anything is sent.
 * state: {model, data, inits: [file|null...], monitors: string, burnIn, samples, thin, seed, timeoutS, chains}
 * where file is {name, text} and numbers are the raw text box strings.
 * @returns {{field: string, controlId: string|null, message: string}[]}
 */
export function validateForm(state) {
  const problems = [];
  const add = (field, message) => problems.push({ field, controlId: controlIdFor(field), message });

  const chains = checkRange('chains', 'Chains', state.chains);
  if (chains.message) add('chains', chains.message);

  const m = checkFileText('The model', state.model, MAX_MODEL_BYTES);
  if (m) add('model', m);
  const d = checkFileText('The data', state.data, MAX_DATA_BYTES);
  if (d) add('data', d);

  const n = chains.value ?? (Array.isArray(state.inits) ? state.inits.length : 0);
  for (let i = 0; i < n; i += 1) {
    const msg = checkFileText(`Initial values for chain ${i + 1}`, state.inits?.[i] ?? null, MAX_DATA_BYTES);
    if (msg) add(`inits[${i}]`, msg);
  }

  const names = parseMonitors(state.monitors);
  if (names.length < LIMITS.monitors.min || names.length > LIMITS.monitors.max) {
    add('monitors', `Provide from ${LIMITS.monitors.min} to ${LIMITS.monitors.max} monitor names, separated by commas or spaces. You provided ${names.length}.`);
  } else {
    const seen = new Set();
    for (const name of names) {
      if (!NODE_RE.test(name)) {
        add('monitors', `Monitor name ${JSON.stringify(name.slice(0, 40))} is not valid. Start with a letter, then use letters, digits, underscore or dot (up to 64 characters).`);
        break;
      }
      if (seen.has(name)) {
        add('monitors', `Monitor "${name}" is listed more than once. List each name once.`);
        break;
      }
      seen.add(name);
    }
  }

  for (const { field, label } of NUMBER_FIELDS) {
    const r = checkRange(field, label, state[field]);
    if (r.message) add(field, r.message);
  }
  return problems;
}

/** Build the Run_Request JSON. Call only when validateForm returned no problems. */
export function buildRequest(state) {
  const chains = parseWhole(state.chains);
  const req = {
    model: state.model.text,
    data: state.data.text,
    inits: state.inits.slice(0, chains).map((f) => f.text),
    monitors: parseMonitors(state.monitors),
    burnIn: parseWhole(state.burnIn),
    samples: parseWhole(state.samples),
    thin: parseWhole(state.thin),
    seed: parseWhole(state.seed),
    timeoutS: parseWhole(state.timeoutS),
    chains,
  };
  const names = {};
  const base = (f) => safeBaseName(f?.name);
  if (state.model?.name && base(state.model)) names.model = base(state.model);
  if (state.data?.name && base(state.data)) names.data = base(state.data);
  const inits = state.inits.slice(0, chains).map(base);
  if (inits.every(Boolean) && inits.length > 0) names.inits = inits;
  if (Object.keys(names).length > 0) req.names = names;
  return req;
}

/** Base name of at most 100 plain characters, or '' when nothing usable remains. */
export function safeBaseName(name) {
  if (typeof name !== 'string') return '';
  const last = name.split(/[\\/]/).pop() ?? '';
  const plain = last.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 100);
  return plain === '.' || plain === '..' ? '' : plain;
}

/** Turn a demo's Run_Request into form state. */
export function stateFromDemo(demo) {
  const r = demo.request;
  const file = (label, text) => ({ name: label, text, fromDemo: true });
  return {
    model: file('model.txt', r.model),
    data: file('data.txt', r.data),
    inits: r.inits.map((t, i) => file(`inits${i + 1}.txt`, t)),
    monitors: r.monitors.join(', '),
    burnIn: String(r.burnIn),
    samples: String(r.samples),
    thin: String(r.thin),
    seed: String(r.seed),
    timeoutS: String(r.timeoutS),
    chains: String(r.chains),
  };
}

/** Normalise a server problem list (from /api/validate or a 400) for display. */
export function normalizeProblems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.message === 'string')
    .map((p) => ({ field: String(p.field ?? ''), controlId: controlIdFor(p.field), message: p.message }));
}

/** Group problems by control id; problems without a control go under ''. */
export function groupByControl(problems) {
  const map = new Map();
  for (const p of problems) {
    const key = p.controlId ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return map;
}

/** The control to focus: the first problem that has a control, in page order of the problem list. */
export function firstFocusTarget(problems) {
  const first = problems.find((p) => p.controlId);
  return first ? first.controlId : null;
}

export function summaryHeading(count) {
  return count === 1 ? 'There is 1 problem to fix before this can run' : `There are ${count} problems to fix before this can run`;
}

export const resultsUrl = (id) => `/results.html?id=${encodeURIComponent(id)}`;

/** Plain-English message for a failed HTTP call to the local server. */
export function describeHttpFailure(status, body) {
  if (status === 429) return 'A run is already in progress. This build runs one analysis at a time. Wait for it to finish, then try again.';
  if (status === 403) return 'The local server refused the request. Open this page from the address that the start script printed.';
  if (status === 413) return 'The inputs are too large for the local server to accept.';
  if (status >= 500) return 'The local server hit an error. Check the terminal where it is running.';
  if (body && typeof body.error === 'string') return body.error;
  return `The local server answered with status ${status}.`;
}

// validate.mjs: Run_Request schema and limits (pure, no I/O).
// Ranges mirror services/runner/reprolab_runner/adapter.py (RunSettings.validate and the
// size caps), except TIMEOUT_MAX_S, which is 300 here (the Runner accepts up to 3600).
// Requirements 4.1 to 4.5, 4.9, 4.10.

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
export const NODE_RE = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;
export const ASCII_RE = /^[\x09\x0A\x0D\x20-\x7E]*$/;

const KNOWN_KEYS = new Set([
  'model', 'data', 'inits', 'monitors', 'burnIn', 'samples', 'thin', 'seed', 'timeoutS', 'chains', 'names',
]);
const MAX_NAME_LENGTH = 255;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkInt(req, field, label, problems) {
  const { min, max } = LIMITS[field];
  const v = req[field];
  if (v === undefined || v === null) {
    problems.push({ field, message: `${label} is required. Enter a whole number from ${min} to ${max}.` });
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    problems.push({ field, message: `${label} must be a whole number from ${min} to ${max}.` });
    return undefined;
  }
  if (v < min || v > max) {
    problems.push({ field, message: `${label} must be from ${min} to ${max}, but it is ${v}.` });
    return undefined;
  }
  return v;
}

function checkText(value, field, label, maxBytes, problems) {
  if (typeof value !== 'string') {
    problems.push({ field, message: `${label} is required and must be text.` });
    return false;
  }
  if (value.includes('\0')) {
    problems.push({ field, message: `${label} contains a NUL character. Remove it and try again.` });
    return false;
  }
  if (!ASCII_RE.test(value)) {
    problems.push({ field, message: `${label} must be plain ASCII text. Remove accented, non-English or other special characters.` });
    return false;
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes === 0) {
    problems.push({ field, message: `${label} is empty. Add the file contents.` });
    return false;
  }
  if (bytes > maxBytes) {
    problems.push({ field, message: `${label} is ${bytes} bytes, which is over the limit of ${maxBytes} bytes.` });
    return false;
  }
  return true;
}

function checkNames(names, inits, problems) {
  if (names === undefined) return;
  if (!isPlainObject(names)) {
    problems.push({ field: 'names', message: 'names must be an object with model, data and inits.' });
    return;
  }
  const okName = (s) => typeof s === 'string' && s.length >= 1 && s.length <= MAX_NAME_LENGTH && !s.includes('\0');
  for (const key of ['model', 'data']) {
    if (names[key] !== undefined && !okName(names[key])) {
      problems.push({ field: `names.${key}`, message: `names.${key} must be text of 1 to ${MAX_NAME_LENGTH} characters with no NUL.` });
    }
  }
  if (names.inits !== undefined) {
    if (!Array.isArray(names.inits) || !names.inits.every(okName)) {
      problems.push({ field: 'names.inits', message: `names.inits must be a list of names of 1 to ${MAX_NAME_LENGTH} characters with no NUL.` });
    } else if (Array.isArray(inits) && names.inits.length !== inits.length) {
      problems.push({ field: 'names.inits', message: 'names.inits must have one name per inits text.' });
    }
  }
  for (const key of Object.keys(names)) {
    if (!['model', 'data', 'inits'].includes(key)) {
      problems.push({ field: `names.${key}`, message: `Unknown field "names.${key}". Remove it.` });
    }
  }
}

/**
 * Validate a Run_Request. Never throws and never starts anything.
 * @returns {{ok: boolean, problems: {field: string, message: string}[], value: object|null}}
 */
export function validateRunRequest(obj) {
  const problems = [];
  if (!isPlainObject(obj)) {
    return { ok: false, problems: [{ field: 'request', message: 'The request must be a JSON object.' }], value: null };
  }
  for (const key of Object.keys(obj)) {
    if (!KNOWN_KEYS.has(key)) problems.push({ field: key, message: `Unknown field "${key}". Remove it.` });
  }

  checkText(obj.model, 'model', 'The model', MAX_MODEL_BYTES, problems);
  checkText(obj.data, 'data', 'The data', MAX_DATA_BYTES, problems);

  // Inits: one text per chain.
  if (!Array.isArray(obj.inits)) {
    problems.push({ field: 'inits', message: 'Initial values are required: provide a list with one text per chain.' });
  } else if (obj.inits.length < LIMITS.chains.min || obj.inits.length > LIMITS.chains.max) {
    problems.push({
      field: 'inits',
      message: `Provide one initial-values text per chain, from ${LIMITS.chains.min} to ${LIMITS.chains.max}. You provided ${obj.inits.length}.`,
    });
  } else {
    obj.inits.forEach((text, i) => {
      checkText(text, `inits[${i}]`, `Initial values for chain ${i + 1}`, MAX_DATA_BYTES, problems);
    });
  }

  // Optional chains field: must agree with the inits count.
  if (obj.chains !== undefined) {
    const c = checkInt(obj, 'chains', 'Chains', problems);
    if (c !== undefined && Array.isArray(obj.inits) && obj.inits.length !== c) {
      problems.push({
        field: 'inits',
        message: `You asked for ${c} chain${c === 1 ? '' : 's'} but provided ${obj.inits.length} initial-values text${obj.inits.length === 1 ? '' : 's'}. Provide exactly one per chain.`,
      });
    }
  }

  // Monitors.
  if (!Array.isArray(obj.monitors)) {
    problems.push({ field: 'monitors', message: 'Monitors are required: provide a list of 1 to 25 variable names.' });
  } else if (obj.monitors.length < LIMITS.monitors.min || obj.monitors.length > LIMITS.monitors.max) {
    problems.push({
      field: 'monitors',
      message: `Provide from ${LIMITS.monitors.min} to ${LIMITS.monitors.max} monitor names. You provided ${obj.monitors.length}.`,
    });
  } else {
    const seen = new Set();
    obj.monitors.forEach((name, i) => {
      if (typeof name !== 'string' || !NODE_RE.test(name)) {
        const shown = typeof name === 'string' ? JSON.stringify(name.slice(0, 40)) : 'a non-text value';
        problems.push({
          field: `monitors[${i}]`,
          message: `Monitor name ${shown} is not valid. Start with a letter, then use letters, digits, underscore or dot (up to 64 characters).`,
        });
      } else if (seen.has(name)) {
        problems.push({ field: `monitors[${i}]`, message: `Monitor "${name}" is listed more than once. List each name once.` });
      } else {
        seen.add(name);
      }
    });
  }

  const burnIn = checkInt(obj, 'burnIn', 'Burn-in', problems);
  const samples = checkInt(obj, 'samples', 'Samples', problems);
  const thin = checkInt(obj, 'thin', 'Thin', problems);
  const seed = checkInt(obj, 'seed', 'Seed', problems);
  const timeoutS = checkInt(obj, 'timeoutS', 'Time limit (seconds)', problems);

  checkNames(obj.names, obj.inits, problems);

  if (problems.length > 0) return { ok: false, problems, value: null };

  const value = {
    model: obj.model,
    data: obj.data,
    inits: [...obj.inits],
    monitors: [...obj.monitors],
    burnIn, samples, thin, seed, timeoutS,
    chains: obj.inits.length,
  };
  if (obj.names !== undefined) {
    value.names = {};
    if (obj.names.model !== undefined) value.names.model = obj.names.model;
    if (obj.names.data !== undefined) value.names.data = obj.names.data;
    if (obj.names.inits !== undefined) value.names.inits = [...obj.names.inits];
  }
  return { ok: true, problems: [], value };
}

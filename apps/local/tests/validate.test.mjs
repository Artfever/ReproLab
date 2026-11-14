import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRunRequest, LIMITS, MAX_MODEL_BYTES, MAX_DATA_BYTES } from '../src/validate.mjs';

const good = () => ({
  model: 'model { r ~ dbin(p, n); p ~ dbeta(1, 1) }',
  data: 'list(r=7, n=10)',
  inits: ['list(p=0.3)', 'list(p=0.8)'],
  monitors: ['p'],
  burnIn: 1000, samples: 10000, thin: 1, seed: 1, timeoutS: 60,
});
const problemsOf = (req) => validateRunRequest(req).problems;
const fields = (req) => problemsOf(req).map((p) => p.field);

test('a valid request is accepted and chains is derived from inits', () => {
  const r = validateRunRequest(good());
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
  assert.equal(r.value.chains, 2);
});

test('non-object requests are rejected', () => {
  for (const bad of [null, undefined, 5, 'x', []]) {
    const r = validateRunRequest(bad);
    assert.equal(r.ok, false);
    assert.equal(r.problems[0].field, 'request');
  }
});

// field, min, max
const RANGES = [
  ['burnIn', 0, 50000], ['samples', 1, 50000], ['thin', 1, 100], ['seed', 1, 14], ['timeoutS', 1, 300],
];
for (const [field, min, max] of RANGES) {
  test(`${field}: min ${min} and max ${max} accepted, min-1 and max+1 rejected`, () => {
    for (const v of [min, max]) assert.equal(validateRunRequest({ ...good(), [field]: v }).ok, true, `${field}=${v}`);
    for (const v of [min - 1, max + 1]) {
      const p = problemsOf({ ...good(), [field]: v });
      assert.equal(p.length, 1, `${field}=${v}`);
      assert.equal(p[0].field, field);
      assert.match(p[0].message, new RegExp(`from ${min} to ${max}`));
    }
  });
  test(`${field}: non-integers and missing values are rejected`, () => {
    for (const v of [1.5, '5', NaN, Infinity, null, undefined, true]) {
      assert.deepEqual(fields({ ...good(), [field]: v }), [field], `${field}=${String(v)}`);
    }
  });
}

test('chains 1..4 accepted when inits count matches; 0 and 5 rejected', () => {
  for (let c = 1; c <= 4; c++) {
    const req = { ...good(), chains: c, inits: Array.from({ length: c }, () => 'list(p=0.5)') };
    assert.equal(validateRunRequest(req).ok, true, `chains=${c}`);
  }
  assert.deepEqual(fields({ ...good(), chains: 0, inits: [] }).sort(), ['chains', 'inits']);
  const five = { ...good(), chains: 5, inits: Array.from({ length: 5 }, () => 'list(p=0.5)') };
  assert.deepEqual(fields(five).sort(), ['chains', 'inits']);
});

test('inits count must equal chains, in plain English', () => {
  const p = problemsOf({ ...good(), chains: 3 });
  assert.equal(p.length, 1);
  assert.equal(p[0].field, 'inits');
  assert.match(p[0].message, /3 chains but provided 2 initial-values texts/);
});

test('inits must be a non-empty list of at most 4 non-empty texts', () => {
  assert.deepEqual(fields({ ...good(), inits: 'list(p=1)' }), ['inits']);
  assert.deepEqual(fields({ ...good(), inits: [] }), ['inits']);
  assert.deepEqual(fields({ ...good(), inits: ['a', 'b', 'c', 'd', 'e'] }), ['inits']);
  assert.deepEqual(fields({ ...good(), inits: [''] }), ['inits[0]']);
  assert.deepEqual(fields({ ...good(), inits: ['ok', 7] }), ['inits[1]']);
});

test('model size: 0 rejected, max accepted, max+1 rejected', () => {
  assert.deepEqual(fields({ ...good(), model: '' }), ['model']);
  assert.equal(validateRunRequest({ ...good(), model: 'a'.repeat(MAX_MODEL_BYTES) }).ok, true);
  const p = problemsOf({ ...good(), model: 'a'.repeat(MAX_MODEL_BYTES + 1) });
  assert.deepEqual(p.map((x) => x.field), ['model']);
  assert.match(p[0].message, /262144/);
});

test('data size: 0 rejected, max accepted, max+1 rejected', () => {
  assert.deepEqual(fields({ ...good(), data: '' }), ['data']);
  assert.equal(validateRunRequest({ ...good(), data: 'a'.repeat(MAX_DATA_BYTES) }).ok, true);
  assert.deepEqual(fields({ ...good(), data: 'a'.repeat(MAX_DATA_BYTES + 1) }), ['data']);
});

test('inits size: max accepted, max+1 rejected', () => {
  const at = (n) => ({ ...good(), inits: ['a'.repeat(n), 'list(p=1)'] });
  assert.equal(validateRunRequest(at(MAX_DATA_BYTES)).ok, true);
  assert.deepEqual(fields(at(MAX_DATA_BYTES + 1)), ['inits[0]']);
});

test('non-ASCII and NUL are rejected in model, data and inits', () => {
  for (const [field, build] of [
    ['model', (s) => ({ ...good(), model: s })],
    ['data', (s) => ({ ...good(), data: s })],
    ['inits[1]', (s) => ({ ...good(), inits: ['list(p=1)', s] })],
  ]) {
    const na = problemsOf(build('list(p=\u00e9)'));
    assert.deepEqual(na.map((p) => p.field), [field]);
    assert.match(na[0].message, /plain ASCII/);
    const nul = problemsOf(build('list(p=1)\0'));
    assert.deepEqual(nul.map((p) => p.field), [field]);
    assert.match(nul[0].message, /NUL/);
  }
});

test('ASCII tab, newline and carriage return are allowed; other control characters are not', () => {
  assert.equal(validateRunRequest({ ...good(), model: 'model {\r\n\t}\n' }).ok, true);
  assert.deepEqual(fields({ ...good(), model: 'model\x07{}' }), ['model']);
});

test('monitors: 25 accepted, 26 and 0 rejected', () => {
  const names = (n) => Array.from({ length: n }, (_, i) => `m${i}`);
  assert.equal(validateRunRequest({ ...good(), monitors: names(25) }).ok, true);
  assert.deepEqual(fields({ ...good(), monitors: names(26) }), ['monitors']);
  assert.deepEqual(fields({ ...good(), monitors: [] }), ['monitors']);
  assert.deepEqual(fields({ ...good(), monitors: 'p' }), ['monitors']);
});

test('monitor names: pattern and duplicates', () => {
  assert.equal(validateRunRequest({ ...good(), monitors: ['a', 'B.c_1', 'x'.repeat(64)] }).ok, true);
  for (const bad of ['1a', '_a', 'a-b', 'a b', '', 'x'.repeat(65), "a'); modelQuit('yes'", 7]) {
    assert.deepEqual(fields({ ...good(), monitors: [bad] }), ['monitors[0]'], String(bad));
  }
  const dup = problemsOf({ ...good(), monitors: ['p', 'q', 'p'] });
  assert.deepEqual(dup.map((p) => p.field), ['monitors[2]']);
  assert.match(dup[0].message, /more than once/);
});

test('unknown keys are rejected by name', () => {
  const p = problemsOf({ ...good(), engine: '/bin/sh' });
  assert.deepEqual(p.map((x) => x.field), ['engine']);
  assert.match(p[0].message, /Unknown field "engine"/);
  assert.deepEqual(fields({ ...good(), names: { model: 'm.txt', path: '../x' } }), ['names.path']);
});

test('names are optional, bounded text and never alter staging names', () => {
  const r = validateRunRequest({ ...good(), names: { model: 'my model.txt', data: 'd.txt', inits: ['a', 'b'] } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.names.inits, ['a', 'b']);
  assert.deepEqual(fields({ ...good(), names: { inits: ['a'] } }), ['names.inits']);
  assert.deepEqual(fields({ ...good(), names: { model: 'x'.repeat(256) } }), ['names.model']);
  assert.deepEqual(fields({ ...good(), names: 'x' }), ['names']);
});

test('several problems are all reported, each with a field and a sentence', () => {
  const p = problemsOf({ ...good(), burnIn: -1, samples: 0, thin: 101 });
  assert.deepEqual(p.map((x) => x.field), ['burnIn', 'samples', 'thin']);
  for (const x of p) assert.match(x.message, /^[A-Z].*\.$/);
});

test('the input object is not mutated and value is a copy', () => {
  const req = good();
  const snapshot = JSON.stringify(req);
  const r = validateRunRequest(req);
  assert.equal(JSON.stringify(req), snapshot);
  r.value.inits.push('x');
  assert.equal(req.inits.length, 2);
});

test('pin: numeric ranges equal services/runner adapter.py (timeout max 300 vs 3600)', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../../services/runner/reprolab_runner/adapter.py', import.meta.url)),
    'utf8',
  );
  const num = (s) => Number(s.replace(/_/g, ''));
  const range = (re) => {
    const m = src.match(re);
    assert.ok(m, `adapter.py pattern not found: ${re}`);
    return { min: num(m[1]), max: num(m[2]) };
  };
  assert.deepEqual(range(/(1) <= n_chains <= (\d+)/), LIMITS.chains);
  assert.equal(range(/(\d+) <= self\.burn_in <= ([\d_]+)/).min, LIMITS.burnIn.min);
  assert.equal(range(/(\d+) <= self\.burn_in <= ([\d_]+)/).max, LIMITS.burnIn.max);
  assert.deepEqual(range(/(\d+) <= self\.samples <= ([\d_]+)/), LIMITS.samples);
  assert.deepEqual(range(/(\d+) <= self\.thin <= ([\d_]+)/), LIMITS.thin);
  assert.deepEqual(range(/(\d+) <= self\.seed <= ([\d_]+)/), LIMITS.seed);
  const t = range(/(\d+) <= self\.timeout_s <= ([\d_]+)/);
  assert.equal(t.min, LIMITS.timeoutS.min);
  assert.equal(t.max, 3600);
  assert.equal(LIMITS.timeoutS.max, 300);
  assert.match(src, /1 <= len\(self\.monitors\) <= 25/);
  assert.equal(LIMITS.monitors.min, 1);
  assert.equal(LIMITS.monitors.max, 25);
  assert.match(src, new RegExp(`MAX_MODEL_BYTES = ${MAX_MODEL_BYTES / 1024} \\* 1024`));
  assert.match(src, new RegExp(`MAX_DATA_BYTES = ${MAX_DATA_BYTES / 1048576} \\* 1024 \\* 1024`));
  assert.ok(src.includes('NODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.]{0,63}$")'));
});

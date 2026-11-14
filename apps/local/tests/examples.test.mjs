import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateRunRequest } from '../src/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const coin = path.join(root, 'examples', 'reprolab', 'coin');
const bad = path.join(root, 'examples', 'reprolab', 'coin-invalid');
const ASCII = /^[\x09\x0A\x0D\x20-\x7E]*$/;
const read = (dir, name) => readFileSync(path.join(dir, name), 'utf8');

const coinFiles = ['model.txt', 'data.txt', 'inits1.txt', 'inits2.txt', 'README.md'].map((n) => [coin, n]);
const badFiles = ['model.txt', 'README.md'].map((n) => [bad, n]);

test('all demonstration files exist, are ASCII and non-empty', () => {
  for (const [dir, name] of [...coinFiles, ...badFiles]) {
    const p = path.join(dir, name);
    assert.ok(existsSync(p), `${p} missing`);
    const text = read(dir, name);
    assert.ok(text.length > 0, `${name} empty`);
    assert.match(text, ASCII, `${name} not plain ASCII`);
  }
});

test('sizes are within the caps', () => {
  assert.ok(Buffer.byteLength(read(coin, 'model.txt')) <= 262144);
  for (const n of ['data.txt', 'inits1.txt', 'inits2.txt']) {
    assert.ok(Buffer.byteLength(read(coin, n)) <= 2097152);
  }
});

test('assembled coin request passes validateRunRequest', () => {
  const result = validateRunRequest({
    model: read(coin, 'model.txt'),
    data: read(coin, 'data.txt'),
    inits: [read(coin, 'inits1.txt'), read(coin, 'inits2.txt')],
    monitors: ['p'],
    burnIn: 1000,
    samples: 10000,
    thin: 1,
    seed: 1,
    timeoutS: 120,
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
});

test('invalid model has unbalanced parentheses and still validates as a request', () => {
  const model = read(bad, 'model.txt');
  const opens = (model.match(/\(/g) || []).length;
  const closes = (model.match(/\)/g) || []).length;
  assert.notEqual(opens, closes);
  const result = validateRunRequest({
    model,
    data: read(coin, 'data.txt'),
    inits: [read(coin, 'inits1.txt'), read(coin, 'inits2.txt')],
    monitors: ['p'],
    burnIn: 1000,
    samples: 10000,
    thin: 1,
    seed: 1,
    timeoutS: 120,
  });
  assert.equal(result.ok, true);
});

test('coin README states the analytic reference and ownership', () => {
  const t = read(coin, 'README.md');
  for (const s of ['Beta(8, 4)', '0.6667', '0.1307', '0.01', 'ReproLab']) {
    assert.ok(t.includes(s), `README lacks ${s}`);
  }
  assert.match(read(bad, 'README.md'), /ReproLab/);
});

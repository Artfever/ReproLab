// Tests for demos.mjs and routes/demos.mjs (spec 03-local-product task 4.1; Requirements 9.7, 10.4 to 10.6).
// Seeds files here are synthetic ReproLab text; the hash list is computed in a temp directory.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { listDemos, parseHashFile, SEEDS_FILES } from '../src/demos.mjs';
import { createServer } from '../src/server.mjs';
import { validateRunRequest } from '../src/validate.mjs';

let tmp;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const content = (n) => `synthetic ${n}\n`;

function fixture(name, { write = SEEDS_FILES, override = {} } = {}) {
  const up = path.join(tmp, name, 'upstream');
  fs.mkdirSync(up, { recursive: true });
  for (const f of write) fs.writeFileSync(path.join(up, f), override[f] ?? content(f));
  const hashFile = path.join(tmp, name, 'hashes.txt');
  fs.writeFileSync(hashFile, SEEDS_FILES.map((f) => `${sha(content(f))}  ${f}`).join('\n') + '\nffff\n');
  return { upstreamDir: up, hashFile };
}
const seeds = (list) => list.find((d) => d.kind === 'upstream');

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-demos-'));
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('parseHashFile reads hash and name, ignores other lines', () => {
  const m = parseHashFile(`${'a'.repeat(64)}  X.txt\nnot a line\n`);
  assert.deepEqual([...m], [['X.txt', 'a'.repeat(64)]]);
});

test('coin and coin-invalid demos carry requests; coin passes validation', () => {
  const list = listDemos({ ...fixture('base') });
  const coin = list.find((d) => d.id === 'coin');
  const bad = list.find((d) => d.id === 'coin-invalid');
  assert.equal(coin.kind, 'reprolab');
  assert.equal(bad.kind, 'invalid');
  assert.equal(validateRunRequest(coin.request).ok, true);
  assert.notEqual(coin.request.model, bad.request.model);
});

test('Seeds absent: no request, missingReason explains extraction', () => {
  const s = seeds(listDemos({ upstreamDir: path.join(tmp, 'nope'), hashFile: fixture('abs').hashFile }));
  assert.equal(s.request, undefined);
  assert.match(s.missingReason, /extract-seeds/);
  assert.match(s.label, /Historical/);
});

test('Seeds partial: no request, names the missing file', () => {
  const s = seeds(listDemos(fixture('part', { write: SEEDS_FILES.slice(0, 3) })));
  assert.equal(s.request, undefined);
  assert.match(s.missingReason, /missing: Seedsinits2\.txt/);
});

test('Seeds with a wrong hash is not offered', () => {
  const s = seeds(listDemos(fixture('wrong', { override: { 'Seedsdata.txt': 'tampered' } })));
  assert.equal(s.request, undefined);
  assert.match(s.missingReason, /does not match the recorded hash: Seedsdata\.txt/);
});

test('Seeds with an unreadable hash list is not offered', () => {
  const f = fixture('nohash');
  const s = seeds(listDemos({ upstreamDir: f.upstreamDir, hashFile: path.join(tmp, 'missing.txt') }));
  assert.equal(s.request, undefined);
  assert.ok(s.missingReason);
});

test('Seeds with all four correct files carries the assembled request and the historical label', () => {
  const s = seeds(listDemos(fixture('ok')));
  assert.equal(s.title, 'Seeds (your own upstream copy)');
  assert.equal(s.missingReason, undefined);
  assert.equal(s.request.model, content('Seedsmodel.txt'));
  assert.equal(s.request.data, content('Seedsdata.txt'));
  assert.deepEqual(s.request.inits, [content('Seedsinits1.txt'), content('Seedsinits2.txt')]);
  assert.match(s.label, /Historical/);
});

test('GET /api/demos returns the list over HTTP', async () => {
  const app = createServer({ demos: fixture('http'), log: () => {} });
  const { port } = await app.listen(0);
  try {
    const body = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/demos', agent: false }, (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString('utf8') }));
      }).on('error', reject);
    });
    assert.equal(body.status, 200);
    const list = JSON.parse(body.text);
    assert.deepEqual(list.map((d) => d.id), ['coin', 'coin-invalid', 'seeds-upstream']);
    assert.ok(list[2].request);
  } finally {
    await app.close();
  }
});

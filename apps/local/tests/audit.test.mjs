import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { audit, auditRepo, parseUpstreamHashes, MAX_BYTES } from '../../../scripts/audit-tracked.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

function run(files, extra = {}) {
  const contents = new Map(Object.entries(files));
  return audit({
    files: [...contents.keys()],
    readFile: (p) => Buffer.from(contents.get(p) ?? ''),
    sizeOf: (p) => Buffer.byteLength(contents.get(p) ?? ''),
    ...extra,
  });
}
const rules = (r) => r.map((f) => f.rule);

test('clean file list passes', () => {
  assert.deepEqual(run({ 'README.md': 'hello', 'apps/local/src/a.mjs': 'export {}' }), []);
});

test('forbidden extensions fail', () => {
  for (const f of ['a.tar', 'a.tar.gz', 'a.tgz', 'a.zip', 'a.so', 'a.dll', 'a.exe', 'a.odc', 'a.bmp', 'A.ZIP']) {
    assert.ok(rules(run({ [f]: 'x' })).includes('forbidden-extension'), f);
  }
});

test('forbidden path prefixes fail', () => {
  for (const f of ['vendor/x.txt', 'local-data/x.txt', 'runs/r1/log.txt']) {
    assert.ok(rules(run({ [f]: 'x' })).includes('forbidden-path'), f);
  }
  assert.deepEqual(run({ 'apps/vendor-notes.md': 'x' }), []);
});

test('upstream example with matching name and hash fails; same name, other content passes', () => {
  const body = 'upstream text';
  const hash = createHash('sha256').update(body).digest('hex');
  const upstream = parseUpstreamHashes(`${hash}  Seedsdata.txt\n`);
  assert.deepEqual(rules(run({ 'x/Seedsdata.txt': body }, { upstream })), ['upstream-example']);
  assert.deepEqual(run({ 'x/Seedsdata.txt': 'different' }, { upstream }), []);
});

test('credential patterns fail', () => {
  const bad = {
    key: '-----BEGIN ' + 'RSA PRIVATE KEY-----\nabc',
    sk: 'token sk' + '-' + 'a'.repeat(20),
    bearer: 'Authorization: Bearer ' + 'b'.repeat(20),
    env: 'REPROLAB_LLM_API_KEY' + '=abc123',
  };
  for (const [k, v] of Object.entries(bad)) {
    assert.ok(rules(run({ [`f-${k}.txt`]: v })).includes('credential'), k);
  }
});

test('credential negatives pass', () => {
  assert.deepEqual(run({
    'a.md': 'REPROLAB_LLM_API_KEY' + '=\nsk' + '-short Bearer ' + 'abc',
    'b.mjs': 'const e = { REPROLAB_LLM_API_KEY' + ': KEY, X: 1 };',
    'c.sh': 'REPROLAB_LLM_API_KEY' + '=$SECRET_FROM_ENV',
  }), []);
  assert.ok(rules(run({ 'd.mjs': 'x = { REPROLAB_LLM_API_KEY' + ": 'abc' }" })).includes('credential'));
});

test('tracked file over 5 MiB fails', () => {
  const r = audit({
    files: ['big.txt'],
    readFile: () => Buffer.from('x'),
    sizeOf: () => MAX_BYTES + 1,
  });
  assert.deepEqual(rules(r), ['too-large']);
});

test('machine paths with a user name fail; placeholders pass', () => {
  assert.ok(rules(run({ 'a.md': 'C:\\Users\\' + 'alice\\proj' })).includes('machine-path'));
  assert.ok(rules(run({ 'a.md': '/home/' + 'bob/work' })).includes('machine-path'));
  assert.deepEqual(run({ 'a.md': 'C:\\Users\\<user>\\x and /home/user/x and /Users/you/x' }), []);
});

test('the real tracked tree passes', () => {
  const { files, findings } = auditRepo(repoRoot);
  assert.ok(files.length > 0);
  assert.deepEqual(findings, []);
});

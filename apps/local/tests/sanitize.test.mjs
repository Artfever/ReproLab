import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { scrubPaths, safeBaseName, isRunId, isSafeFileName, LOCAL_PATH } from '../src/sanitize.mjs';

const repo = process.cwd();
const home = os.homedir();
const roots = [repo, home];
const fwd = (p) => p.replace(/\\/g, '/');
const back = (p) => fwd(p).replace(/\//g, '\\');

function assertClean(out) {
  for (const r of roots) {
    for (const s of [r, fwd(r), back(r), encodeURI(fwd(r)), encodeURIComponent(fwd(r))]) {
      assert.ok(!out.toLowerCase().includes(s.toLowerCase()), `leaked ${s} in ${out}`);
    }
  }
}

test('scrubs repository root and home in raw, forward and back slash forms', () => {
  for (const r of roots) {
    for (const form of [r, fwd(r), back(r)]) {
      const out = scrubPaths(`error at ${form}${form.includes('\\') ? '\\' : '/'}x.txt end`, roots);
      assert.ok(out.includes(LOCAL_PATH));
      assertClean(out);
    }
  }
});

test('scrubs file:/// and URL-encoded forms', () => {
  const p = fwd(repo);
  const prefix = p.startsWith('/') ? 'file://' : 'file:///';
  const inputs = [prefix + p, prefix + encodeURI(p), encodeURI(p), encodeURIComponent(p)];
  for (const s of inputs) {
    const out = scrubPaths(`see ${s}/a`, roots);
    assert.ok(out.includes(LOCAL_PATH), s);
    assertClean(out);
  }
});

test('scrubs paths inside nested JSON strings', () => {
  const obj = { a: { log: `at ${repo}\\x` }, b: [fwd(home)] };
  const once = JSON.stringify(obj);
  const twice = JSON.stringify({ inner: once });
  for (const s of [once, twice]) {
    const out = scrubPaths(s, roots);
    assertClean(out);
    assert.ok(out.includes(LOCAL_PATH));
  }
});

test('is case-insensitive for Windows roots and leaves unrelated text alone', () => {
  if (/^[A-Za-z]:/.test(repo)) {
    assert.ok(!scrubPaths(repo.toUpperCase(), [repo]).toLowerCase().includes(repo.toLowerCase()));
  }
  assert.equal(scrubPaths('nothing to see here', roots), 'nothing to see here');
  assert.equal(scrubPaths('a / b', ['/']), 'a / b');
  assert.equal(scrubPaths('', roots), '');
});

test('safeBaseName strips directories and rejects unusable names', () => {
  assert.equal(safeBaseName('C:\\Users\\me\\model.txt'), 'model.txt');
  assert.equal(safeBaseName('/etc/passwd'), 'passwd');
  assert.equal(safeBaseName('a'.repeat(300)).length, 100);
  assert.equal(safeBaseName('..'), null);
  assert.equal(safeBaseName('bad\0name'), null);
  assert.equal(safeBaseName(''), null);
  assert.equal(safeBaseName(42), null);
});

test('isSafeFileName rejects separators, dot-dot, NUL and empty', () => {
  for (const ok of ['log.txt', 'manifest.json', 'coda_index.txt', 'CODAchain1.txt']) assert.ok(isSafeFileName(ok), ok);
  for (const bad of ['', 'a/b', 'a\\b', '..', '../x', 'a..b', 'a\0b', '.hidden', '/abs', 42, null]) {
    assert.ok(!isSafeFileName(bad), String(bad));
  }
});

test('isRunId accepts only 32 lowercase hex characters', () => {
  assert.ok(isRunId('0123456789abcdef0123456789abcdef'));
  for (const bad of ['', 'ABCDEF0123456789abcdef0123456789', '0123456789abcdef0123456789abcde', '../'.padEnd(32, 'a'), null]) {
    assert.ok(!isRunId(bad), String(bad));
  }
});

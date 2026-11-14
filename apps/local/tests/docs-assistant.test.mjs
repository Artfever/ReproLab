import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DOCS_DIR, loadFilePassages } from '../assistant/corpus.mjs';

const REQUIRED = ['setup', 'running', 'validation', 'states', 'files', 'assistant', 'limitations', 'privacy'];
const LICENSING_DIR = path.resolve(DOCS_DIR, '..', 'evidence', 'licensing');
const WINDOW = 12;

const words = (text) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
function windows(text) {
  const w = words(text);
  const set = new Set();
  for (let i = 0; i + WINDOW <= w.length; i++) set.add(w.slice(i, i + WINDOW).join(' '));
  return set;
}

test('all eight required documents exist and are non-empty', () => {
  for (const stem of REQUIRED) {
    const f = path.join(DOCS_DIR, `${stem}.md`);
    assert.ok(existsSync(f), `missing ${f}`);
    assert.ok(readFileSync(f, 'utf8').trim().length > 0, `${stem}.md is empty`);
  }
});

test('documents are pure ASCII', () => {
  for (const name of readdirSync(DOCS_DIR).filter((n) => n.endsWith('.md'))) {
    const buf = readFileSync(path.join(DOCS_DIR, name));
    const bad = [...buf].findIndex((b) => b > 127);
    assert.equal(bad, -1, `${name} has a non-ASCII byte at offset ${bad}`);
  }
});

test('every document has at least one second-level heading passage', () => {
  const passages = loadFilePassages();
  for (const stem of REQUIRED) {
    assert.ok(passages.some((p) => p.id.startsWith(`${stem}-`)), `${stem}.md has no ## passage`);
  }
});

test('every passage is under 1200 characters', () => {
  for (const p of loadFilePassages()) {
    assert.ok(p.text.length < 1200, `${p.id} has ${p.text.length} characters`);
  }
});

test('every passage id is unique and of the form <stem>-NN', () => {
  const ids = loadFilePassages().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z]+-\d{2}$/);
});

test('no 12-word window is shared with docs/evidence/licensing/*.txt', () => {
  assert.ok(existsSync(LICENSING_DIR), 'licensing evidence directory missing');
  const files = readdirSync(LICENSING_DIR).filter((n) => n.endsWith('.txt'));
  assert.ok(files.length > 0, 'no licensing evidence files found');
  const upstream = new Map();
  for (const f of files) {
    for (const w of windows(readFileSync(path.join(LICENSING_DIR, f), 'utf8'))) upstream.set(w, f);
  }
  for (const name of readdirSync(DOCS_DIR).filter((n) => n.endsWith('.md'))) {
    for (const w of windows(readFileSync(path.join(DOCS_DIR, name), 'utf8'))) {
      assert.ok(!upstream.has(w), `${name} shares "${w}" with ${upstream.get(w)}`);
    }
  }
});

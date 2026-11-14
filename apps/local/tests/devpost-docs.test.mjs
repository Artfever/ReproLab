// Acceptance check for task 13.3 (spec 03-local-product, Requirement 22.3 to 22.5):
// the Devpost checklist has every required row, references only files that exist,
// and does not mark the video as DONE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const text = fs.readFileSync(path.join(root, 'docs', 'devpost-checklist.md'), 'utf8').replace(/\r\n/g, '\n');
const rows = text.split('\n').filter((l) => /^\|/.test(l)).map((l) => l.split('|').map((c) => c.trim()).slice(1, -1));
const rowFor = (re) => rows.find((c) => re.test(c[0]));

test('required rows are present', () => {
  for (const re of [/GitHub repository/i, /YouTube/i, /^Category/i, /Kiro usage/i, /Setup instructions/i, /Hosting/i, /legal name/i, /tarball/i]) {
    assert.ok(rowFor(re), String(re));
  }
  assert.match(text, /Resurrection/);
  assert.match(text, /^## No hosting or deployment/m);
  assert.match(text, /^## Repository availability/m);
  assert.match(text, /^## Known limitations and open items/m);
});

test('the YouTube row is MISSING and no row claims the video is DONE', () => {
  assert.match(rowFor(/YouTube/i)[1], /^MISSING/);
  for (const c of rows) {
    if (/video|recording|youtube/i.test(c[0])) assert.doesNotMatch(c[1], /^DONE/, c[0]);
  }
  assert.doesNotMatch(text, /(?<!\bno )video (was|has been) (uploaded|published|recorded)/i);
});

test('every backticked repository path exists', () => {
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const paths = spans.filter((s) => /^(\.kiro|docs|apps|scripts|examples|infra|services)\//.test(s) || /^(README\.md|LICENSE)$/.test(s));
  assert.ok(paths.length > 20, 'expected many paths');
  for (const p of paths) {
    assert.ok(fs.existsSync(path.join(root, p.replace(/\/$/, ''))), p);
  }
});

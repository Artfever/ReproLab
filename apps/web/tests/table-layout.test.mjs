// Regression test for the task 1.4 review defect: at 390 px, "overflow-wrap: anywhere" on cells let
// every column shrink to one letter, so tables never scrolled and words broke mid-word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WEB_ROOT } from './helpers/html.mjs';

const css = readFileSync(path.join(WEB_ROOT, 'src/app/globals.css'), 'utf8');
const rule = (selector) => {
  const m = new RegExp(`(?:^|\\n|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `no rule for ${selector}`);
  return m[1];
};

test('table has a min-width in rem so narrow screens scroll the labelled region instead of crushing columns', () => {
  const m = /min-width:\s*([\d.]+)rem/.exec(rule('table'));
  assert.ok(m, 'table needs min-width in rem');
  assert.ok(Number(m[1]) >= 30, `min-width ${m[1]}rem is too small to prevent crushed columns`);
});

test('table is wrapped in a horizontally scrolling region', () => {
  assert.match(rule('.table-scroll'), /overflow-x:\s*auto/);
});

test('th and td wrap only at word boundaries (break-word, never "anywhere")', () => {
  const r = rule('th, td');
  assert.match(r, /overflow-wrap:\s*break-word/);
  assert.doesNotMatch(r, /overflow-wrap:\s*anywhere|word-break:\s*break-all/);
});

test('hash cells keep their own break rule so 64-hex strings do not widen the table', () => {
  assert.match(rule('.hash'), /overflow-wrap:\s*anywhere/);
});

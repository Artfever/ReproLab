import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WEB_ROOT } from './helpers/html.mjs';

const css = readFileSync(path.join(WEB_ROOT, 'src/app/globals.css'), 'utf8');
const tok = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum]. The only pairs the CSS may use.
const PAIRS = [
  ['ink', 'paper', 4.5], ['ink', 'surface', 4.5], ['ink', 'band', 4.5], ['muted', 'paper', 4.5], ['muted', 'band', 4.5],
  ['primary', 'paper', 4.5], ['primary', 'surface', 4.5], ['primary', 'band', 4.5], ['surface', 'primary', 4.5],
  ['accent', 'paper', 4.5], ['accent', 'surface', 4.5],
  ['success', 'paper', 4.5], ['success', 'surface', 4.5], ['warning', 'paper', 4.5], ['warning', 'surface', 4.5],
  ['error', 'paper', 4.5], ['error', 'surface', 4.5], ['error', 'band', 4.5],
  ['border-strong', 'paper', 3], ['border-strong', 'surface', 3], ['border-strong', 'band', 3],
  ['primary', 'paper', 3], ['primary', 'surface', 3], ['primary', 'band', 3],
];

test('all tokens named in the contrast table exist in globals.css', () => {
  for (const [f, b] of PAIRS) assert.ok(tok[f] && tok[b], `${f}/${b}`);
});
for (const [f, b, min] of PAIRS) {
  test(`contrast ${f} on ${b} >= ${min}`, () => {
    const r = ratio(tok[f], tok[b]);
    assert.ok(r >= min, `${f} ${tok[f]} on ${b} ${tok[b]} = ${r.toFixed(2)} < ${min}`);
  });
}
test('known failing accent value stays rejected', () => {
  assert.ok(ratio('#B65C3A', tok.paper) < 4.5);
  assert.notEqual(tok.accent.toUpperCase(), '#B65C3A');
});
test('css has no external url() or @import', () => {
  assert.doesNotMatch(css, /url\(\s*['"]?https?:|@import/);
});
test('viewport allows zoom', async () => {
  const layout = readFileSync(path.join(WEB_ROOT, 'src/app/layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /maximumScale|maximum-scale|userScalable|user-scalable/);
});
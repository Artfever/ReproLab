// Requirements 1.1, 1.2, 15.1 to 15.7: static page structure, wording and contrast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const FILES = ['index', 'run', 'results', 'how-it-works', 'docs', 'limitations', 'privacy', 'terms'].map((n) => `${n}.html`);
const read = (f) => readFileSync(path.join(PUBLIC, f), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

for (const f of FILES) {
  test(`${f}: structure`, () => {
    assert.ok(existsSync(path.join(PUBLIC, f)), 'file exists');
    const html = read(f);
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html lang="[a-z-]+"/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'exactly one h1');
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /name="viewport"/);
    assert.doesNotMatch(html, /maximum-scale|user-scalable/);
    // skip link is the first focusable element in the body
    const body = html.slice(html.indexOf('<body>'));
    const firstLink = /<a\b[^>]*>/.exec(body)[0];
    assert.match(firstLink, /class="skip-link"/);
    assert.match(firstLink, /href="#main"/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /<nav[^>]*aria-label="[^"]+"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, 'one current page marker');
    for (const [, href] of html.matchAll(/<nav[\s\S]*?<\/nav>/g).next().value[0].matchAll(/href="([^"]+)"/g)) {
      const target = href === '/' ? 'index.html' : href.slice(1);
      assert.ok(FILES.includes(target), `nav link ${href} resolves`);
    }
    assert.equal((html.match(/<nav\b/g) ?? []).length, 1);
    assert.ok(html.match(/<a [^>]*href="\/[^"]*"/g).length >= 8, 'all pages reachable from nav');
  });

  test(`${f}: no remote resources and no inline script or style`, () => {
    const html = read(f);
    assert.doesNotMatch(html, /\b(src|href|action|data|poster)\s*=\s*["']\s*(https?:)?\/\//i);
    assert.doesNotMatch(html, /url\(\s*['"]?(https?:)?\/\//i);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) assert.match(m[1], /\bsrc="\/[^"]+"/, 'script must have a same-origin src');
    assert.doesNotMatch(html, /<script\b[^>]*>\s*[^\s<]/i, 'no inline script body');
    assert.doesNotMatch(html, /<style\b/i);
    assert.doesNotMatch(html, /\sstyle\s*=/i);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no inline event handlers');
    assert.doesNotMatch(html, /<(iframe|img|link)\b(?![^>]*rel="stylesheet")[^>]*(https?:)?\/\//i);
  });
}

test('Home states the product boundary and that a run is not a finding', () => {
  const t = text(read('index.html'));
  assert.match(t, /runs the OpenBUGS command-line workflow locally and does not translate the OpenBUGS language/);
  assert.match(t, /finished run is not a valid scientific finding and not a convergence claim/);
});

test('Privacy states no data leaves the machine and lists assistant call contents', () => {
  const t = text(read('privacy.html'));
  assert.match(t, /No data leaves this machine, except optional calls to the language-model endpoint/);
  assert.match(t, /your question text/);
  assert.match(t, /text of the documentation passages retrieved/);
  assert.match(t, /never sent, unless their content appears in the current run's log lines/);
});

test('Terms: open-source local tool, no hosted service, MIT covers ReproLab code only', () => {
  const t = text(read('terms.html'));
  assert.match(t, /terms are for the open-source local tool/);
  assert.match(t, /No hosted service exists/);
  assert.match(t, /MIT licence covers ReproLab code only/);
});

test('Limitations: included OpenBUGS engine, Docker Desktop only, Seeds historical', () => {
  const t = text(read('limitations.html'));
  assert.match(t, /ReproLab includes OpenBUGS 3\.2\.3 as its inference engine/);
  assert.match(t, /build the local image and test the Coin example/);
  assert.doesNotMatch(t, /NO-GO|release gates/i);
  assert.match(t, /Docker Desktop isolation is the only isolation that has been tested/);
  assert.match(t, /Seeds example are historical/);
});

test('pages do not claim a hosted service, validation or finished features', () => {
  for (const f of FILES) {
    const t = text(read(f));
    assert.doesNotMatch(t, /\b(validated result|guarantee[sd]?|cloud service|sign up|log in)\b/i, f);
  }
});

// ---- contrast (WCAG 2.x relative luminance), written for this app ----
const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const tok = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum]. Every combination styles.css uses.
const PAIRS = [
  ['ink', 'paper', 4.5], ['ink', 'surface', 4.5], ['ink', 'band', 4.5],
  ['muted', 'paper', 4.5], ['muted', 'band', 4.5],
  ['primary', 'paper', 4.5], ['primary', 'surface', 4.5], ['primary', 'band', 4.5],
  ['surface', 'primary', 4.5],
  ['error', 'paper', 4.5], ['error', 'surface', 4.5],
  ['warning', 'paper', 3], ['warning', 'surface', 3],
  ['border-strong', 'paper', 3], ['border-strong', 'surface', 3], ['border-strong', 'band', 3],
  ['primary', 'paper', 3], ['primary', 'surface', 3], ['primary', 'band', 3],
];

test('every colour token named by the contrast table exists', () => {
  for (const [f, b] of PAIRS) assert.ok(tok[f] && tok[b], `${f}/${b}`);
});
test('every colour token declared in styles.css is covered by the table', () => {
  const used = new Set(PAIRS.flat().filter((x) => typeof x === 'string'));
  for (const name of Object.keys(tok)) assert.ok(used.has(name), `token ${name} not in contrast table`);
});
for (const [f, b, min] of PAIRS) {
  test(`contrast ${f} on ${b} >= ${min}`, () => {
    const r = ratio(tok[f], tok[b]);
    assert.ok(r >= min, `${f} ${tok[f]} on ${b} ${tok[b]} = ${r.toFixed(2)} < ${min}`);
  });
}
test('styles.css has no raw colour outside the token block, no remote url or import', () => {
  const rest = css.replace(/:root\s*\{[\s\S]*?\}/, '');
  assert.doesNotMatch(rest, /#[0-9A-Fa-f]{3,8}\b/, 'colours must come from tokens');
  assert.doesNotMatch(css, /url\(|@import|@font-face/);
});
test('styles.css provides visible focus and a skip link', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px/);
  assert.match(css, /\.skip-link:focus/);
});

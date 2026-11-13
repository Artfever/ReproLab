// Checks the built static pages in out/. Run "npm run build" first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WEB_ROOT, bodyHtml, count, links, readPage, sectionHtml, visibleText } from './helpers/html.mjs';
import { fmtInt, fmtNum, fmtSeconds } from '../src/lib/format.mjs';
import { BANNER_LINES, CTA_TEXT, HOME_FIRST, PRE_DECLARED_STATEMENT } from '../src/lib/copy.ts';

const data = JSON.parse(readFileSync(path.join(WEB_ROOT, 'content/sample-run.json'), 'utf8'));
const pages = { home: readPage('home'), sample: readPage('sample'), notFound: readPage('notFound') };
const text = Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, visibleText(v)]));

for (const [k, html] of Object.entries(pages)) {
  test(`${k}: structure (lang, one h1, one main, skip link first, banner, nav)`, () => {
    assert.match(html, /<html lang="en"/);
    assert.equal(count(html, /<h1[ >]/g), 1);
    assert.equal(count(html, /<main[ >]/g), 1);
    assert.equal(count(html, /<header[ >]/g), 1);
    assert.equal(count(html, /<footer[ >]/g), 1);
    assert.equal(count(html, /<nav[ >]/g), 1);
    assert.match(bodyHtml(html), /<body[^>]*>(<div hidden=""><!--\$--><!--\/\$--><\/div>)?<a href="#main" class="skip-link">Skip to main content<\/a><header/);
    assert.ok(html.indexOf('id="limits-title"') < html.indexOf('<h1'), 'limits banner comes before the h1');
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    for (const line of BANNER_LINES) assert.ok(text[k].includes(line), `banner line missing: ${line}`);
  });
  test(`${k}: no forms, buttons, inputs, inline styles, external scripts or style attributes`, () => {
    assert.equal(count(html, /<(form|input|button|textarea|select)\b/g), 0);
    assert.doesNotMatch(html, /\sstyle="/);
    assert.doesNotMatch(html, /<style/);
    assert.doesNotMatch(html, /<script[^>]+src="https?:/);
    assert.doesNotMatch(html, /<(img|iframe|link)[^>]+(src|href)="https?:/);
  });
  test(`${k}: forbidden claims are absent`, () => {
    for (const re of [/scientifically valid/i, /\bvalidated\b/i, /\bhas converged\b|\bconverged\b/i, /\bAI assistant\b/i, /\bapproved\b/i, /production[- ]ready/i, /free to download/i]) {
      assert.doesNotMatch(text[k], re);
    }
  });
}

test('navigation lists exactly Home and Sample run, and every internal link resolves', () => {
  for (const html of Object.values(pages)) {
    const nav = /<nav[\s\S]*?<\/nav>/.exec(bodyHtml(html))[0];
    assert.deepEqual(links(nav).map((l) => [l.href, l.text]), [['/', 'Home'], ['/sample-run', 'Sample run']]);
    for (const l of links(html)) {
      if (/^https?:/.test(l.href) || l.href.startsWith('#')) continue;
      const [p, hash] = l.href.split('#');
      const file = p === '/' ? 'out/index.html' : `out${p}.html`;
      assert.ok(existsSync(path.join(WEB_ROOT, file)), `${l.href} has no built page`);
      if (hash) assert.match(readFileSync(path.join(WEB_ROOT, file), 'utf8'), new RegExp(`id="${hash}"`), l.href);
    }
  }
});
test('current page link has aria-current', () => {
  assert.match(pages.home, /<a aria-current="page" href="\/">Home<\/a>|<a href="\/" aria-current="page">Home<\/a>/);
  assert.match(pages.sample, /aria-current="page"[^>]*>Sample run|Sample run<\/a>/);
});
test('external links use only the two allowed hosts and rel noopener noreferrer', () => {
  const allowed = JSON.parse(readFileSync(path.join(WEB_ROOT, 'external-hosts.json'), 'utf8'));
  for (const html of Object.values(pages)) for (const l of links(html)) {
    if (!/^https?:/.test(l.href)) continue;
    assert.ok(allowed.includes(new URL(l.href).hostname), l.href);
    assert.match(l.attrs, /rel="noopener noreferrer"/);
    assert.ok(l.href.startsWith('https://'));
  }
});

test('home: first-viewport sentence, one call to action, sections, no Run controls', () => {
  assert.ok(text.home.includes(HOME_FIRST));
  assert.ok(text.home.includes('What the tested prototype did'));
  assert.ok(text.home.includes('What the tested prototype did not do'));
  const ctas = links(pages.home).filter((l) => l.text === CTA_TEXT);
  assert.equal(ctas.length, 1);
  assert.equal(ctas[0].href, '/sample-run');
  for (const l of links(pages.home)) assert.doesNotMatch(l.text, /^(run|start|launch|upload|submit)\b/i);
});

test('sample-run: section order and the pre-declared failure comes first', () => {
  const ids = ['about', 'comparison', 'post-hoc', 'inputs', 'settings', 'output-summary', 'runs', 'reproducibility', 'errors', 'limitations'];
  const pos = ids.map((id) => pages.sample.indexOf(`<section id="${id}"`));
  assert.ok(pos.every((p) => p >= 0), `missing section: ${JSON.stringify(pos)}`);
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  const comp = visibleText(sectionHtml(pages.sample, 'comparison'));
  assert.match(sectionHtml(pages.sample, 'comparison'), /<h2[^>]*>The pre-declared comparison failed<\/h2><div[^>]*><p><strong>The pre-declared comparison failed on all five nodes\.<\/strong>/);
  assert.ok(comp.includes(PRE_DECLARED_STATEMENT));
  assert.ok(pages.sample.indexOf(PRE_DECLARED_STATEMENT) < pages.sample.indexOf('id="output-summary"'));
});

test('sample-run: comparison tables are labelled pre_declared or post hoc, and numbers match the data', () => {
  const pre = sectionHtml(pages.sample, 'comparison');
  const post = sectionHtml(pages.sample, 'post-hoc');
  assert.equal((pre.match(/data-comparison-kind="pre_declared"/g) ?? []).length, 2);
  assert.equal((post.match(/data-comparison-kind="post_hoc"/g) ?? []).length, 3);
  assert.equal((pre.match(/>fail</g) ?? []).length, 10);
  assert.doesNotMatch(pre, /pass/);
  for (const cap of post.match(/<caption[^>]*>[^<]*/g)) assert.match(cap, /post hoc:/);
  assert.doesNotMatch(post.replace(/pass \(post hoc\)|fail \(post hoc\)/g, ''), />\s*(pass|fail)\s*</);
  for (const c of data.comparisons) for (const r of c.rows) {
    assert.ok(text.sample.includes(fmtNum(r.mean)) && text.sample.includes(fmtNum(r.sd)), `${c.id}/${r.node}`);
  }
});

test('sample-run: every input and output hash, runtime and byte count shown equals the data', () => {
  const t = text.sample;
  for (const f of data.inputs) assert.ok(t.includes(f.sha256), f.name);
  for (const r of data.runs) {
    assert.ok(t.includes(fmtSeconds(r.runtime_s)), `${r.name} runtime`);
    for (const f of r.outputs) { assert.ok(t.includes(f.sha256), `${r.name}/${f.name}`); assert.ok(t.includes(fmtInt(f.bytes))); }
  }
  assert.ok(t.includes(data.engine.image_id));
  assert.ok(t.includes('Not published here: rights unknown'));
  for (const l of data.program_output) assert.ok(t.includes(l.text));
});

test('sample-run: invalid-model failures state exit code 0 and the post hoc caveats are present', () => {
  const t = text.sample;
  assert.match(t, /bad-syntax: the engine exit code was 0 although the model was invalid/);
  assert.match(t, /chosen after the first comparison failed/);
  assert.match(t, /not an independent confirmation/);
  assert.match(t, /No convergence or scientific-validity claim is made/);
  assert.match(t, /read by eye/);
});

test('every data-claim id on a page exists in the claims data', () => {
  const ids = new Set(data.claims.map((c) => c.id));
  for (const html of Object.values(pages)) for (const m of html.matchAll(/data-claim="([^"]+)"/g)) assert.ok(ids.has(m[1]), m[1]);
});

test('no run of 12 consecutive words is copied from the upstream text corpus', () => {
  const dir = path.join(REPO_ROOT, 'docs/evidence/licensing');
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const grams = new Set();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.txt'))) {
    const w = words(readFileSync(path.join(dir, f), 'utf8'));
    for (let i = 0; i + 12 <= w.length; i++) grams.add(w.slice(i, i + 12).join(' '));
  }
  assert.ok(grams.size > 0, 'corpus is empty');
  for (const [k, t] of Object.entries(text)) {
    const w = words(t);
    for (let i = 0; i + 12 <= w.length; i++) assert.ok(!grams.has(w.slice(i, i + 12).join(' ')), `${k}: copied upstream text near "${w.slice(i, i + 6).join(' ')}"`);
  }
});

test('404 page has an h1 and links home', () => {
  assert.ok(text.notFound.includes('Page not found'));
  assert.ok(links(pages.notFound).some((l) => l.href === '/' && l.text === 'home page'));
});
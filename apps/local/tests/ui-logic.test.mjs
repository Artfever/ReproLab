// Run page logic (task 5.2): requirements 4.7, 4.8, 11.1 to 11.5. DOM-free; plus HTML structure checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../public/run-logic.js';
import * as V from '../src/validate.mjs';
import { listDemos } from '../src/demos.mjs';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const file = (text, name = 'f.txt') => ({ name, text });
const good = () => ({
  model: file('model { r ~ dbin(p, n) }'),
  data: file('list(r=7,n=10)'),
  inits: [file('list(p=0.5)'), file('list(p=0.2)'), null, null],
  monitors: 'p',
  burnIn: '1000', samples: '10000', thin: '1', seed: '1', timeoutS: '120', chains: '2',
});
const fields = (ps) => ps.map((p) => p.field);

test('copied constants equal src/validate.mjs', () => {
  assert.deepEqual(L.LIMITS, V.LIMITS);
  assert.equal(L.MAX_MODEL_BYTES, V.MAX_MODEL_BYTES);
  assert.equal(L.MAX_DATA_BYTES, V.MAX_DATA_BYTES);
  assert.equal(L.NODE_RE_SOURCE, V.NODE_RE.source);
  assert.equal(L.ASCII_RE_SOURCE, V.ASCII_RE.source);
});

test('a valid form has no problems and builds a request the server validator accepts', () => {
  assert.deepEqual(L.validateForm(good()), []);
  const req = L.buildRequest(good());
  const r = V.validateRunRequest(req);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal(req.inits.length, 2);
  assert.deepEqual(req.names, { model: 'f.txt', data: 'f.txt', inits: ['f.txt', 'f.txt'] });
});

test('range messages at min-1, max+1, non-integer and empty; boundaries pass', () => {
  const cases = [['burnIn', 0, 50000], ['samples', 1, 50000], ['thin', 1, 100], ['seed', 1, 14], ['timeoutS', 1, 300]];
  for (const [f, min, max] of cases) {
    for (const ok of [min, max]) { const s = good(); s[f] = String(ok); assert.deepEqual(L.validateForm(s), [], `${f}=${ok}`); }
    for (const bad of [min - 1, max + 1]) {
      const s = good(); s[f] = String(bad);
      const ps = L.validateForm(s);
      assert.equal(ps.length, 1, `${f}=${bad}`);
      assert.equal(ps[0].controlId, f);
      assert.match(ps[0].message, new RegExp(`from ${min} to ${max}, but it is ${bad}`));
    }
    const s = good(); s[f] = '1.5'; assert.match(L.validateForm(s)[0].message, /must be a whole number/);
    s[f] = ''; assert.match(L.validateForm(s)[0].message, /is required/);
    s[f] = 'abc'; assert.match(L.validateForm(s)[0].message, /must be a whole number/);
  }
});

test('chains out of range and inits count follows the chains selector', () => {
  const s = good(); s.chains = '5';
  assert.ok(fields(L.validateForm(s)).includes('chains'));
  const t = good(); t.chains = '3'; // third inits missing
  const ps = L.validateForm(t);
  assert.deepEqual(fields(ps), ['inits[2]']);
  assert.equal(ps[0].controlId, 'inits-3');
  assert.match(ps[0].message, /Initial values for chain 3 is required/);
});

test('empty, non-ASCII, NUL and oversize files are reported next to their field', () => {
  const s = good();
  s.model = file('');
  s.data = file('caf\u00e9');
  s.inits[0] = file('a\0b');
  const ps = L.validateForm(s);
  const byField = Object.fromEntries(ps.map((p) => [p.field, p]));
  assert.match(byField.model.message, /is empty/);
  assert.match(byField.data.message, /plain ASCII/);
  assert.match(byField['inits[0]'].message, /NUL/);
  assert.equal(byField.model.controlId, 'model');
  const big = good(); big.model = file('x'.repeat(L.MAX_MODEL_BYTES + 1));
  assert.match(L.validateForm(big)[0].message, /over the limit of 262144 bytes/);
  const edge = good(); edge.model = file('x'.repeat(L.MAX_MODEL_BYTES));
  assert.deepEqual(L.validateForm(edge), []);
  const none = good(); none.model = null;
  assert.match(L.validateForm(none)[0].message, /Choose a file/);
});

test('monitors: empty, too many, bad name, duplicate; separators', () => {
  const m = (v) => { const s = good(); s.monitors = v; return L.validateForm(s); };
  assert.match(m('')[0].message, /You provided 0/);
  assert.match(m(Array.from({ length: 26 }, (_, i) => `v${i}`).join(','))[0].message, /You provided 26/);
  assert.deepEqual(m(Array.from({ length: 25 }, (_, i) => `v${i}`).join(' ')), []);
  assert.match(m('1abc')[0].message, /is not valid/);
  assert.match(m('p, p')[0].message, /more than once/);
  assert.deepEqual(m('alpha0, alpha1 sigma'), []);
  assert.deepEqual(L.parseMonitors(' a,,b  c '), ['a', 'b', 'c']);
  assert.equal(m('p, p')[0].controlId, 'monitors');
});

test('client checks agree with the server validator on the same inputs', () => {
  const variants = [
    (s) => { s.burnIn = '-1'; }, (s) => { s.samples = '50001'; }, (s) => { s.monitors = 'p,p'; },
    (s) => { s.data = file('\u00e9'); }, (s) => { s.model = file(''); }, (s) => { s.seed = '14'; },
  ];
  for (const mut of variants) {
    const s = good(); mut(s);
    const client = L.validateForm(s).length === 0;
    const req = {
      model: s.model.text, data: s.data.text, inits: s.inits.slice(0, 2).map((f) => f.text),
      monitors: L.parseMonitors(s.monitors), burnIn: L.parseWhole(s.burnIn), samples: L.parseWhole(s.samples),
      thin: L.parseWhole(s.thin), seed: L.parseWhole(s.seed), timeoutS: L.parseWhole(s.timeoutS), chains: 2,
    };
    assert.equal(client, V.validateRunRequest(req).ok);
  }
});

test('control ids map server problem fields; first focus target and grouping', () => {
  assert.equal(L.controlIdFor('inits[0]'), 'inits-1');
  assert.equal(L.controlIdFor('inits[3]'), 'inits-4');
  assert.equal(L.controlIdFor('inits'), 'inits-1');
  assert.equal(L.controlIdFor('monitors[4]'), 'monitors');
  assert.equal(L.controlIdFor('timeoutS'), 'timeoutS');
  assert.equal(L.controlIdFor('request'), null);
  assert.equal(L.controlIdFor('bogus'), null);
  const ps = L.normalizeProblems([
    { field: 'request', message: 'The request must be a JSON object.' },
    { field: 'seed', message: 'Seed must be from 1 to 14, but it is 15.' },
    { field: 'seed', message: 'second' },
    { nope: 1 }, null,
  ]);
  assert.equal(ps.length, 3);
  assert.equal(L.firstFocusTarget(ps), 'seed');
  assert.equal(L.firstFocusTarget([ps[0]]), null);
  const g = L.groupByControl(ps);
  assert.equal(g.get('seed').length, 2);
  assert.equal(g.get('').length, 1);
  assert.deepEqual(L.normalizeProblems('x'), []);
});

test('summary heading, size formatting and results hand-off url', () => {
  assert.equal(L.summaryHeading(1), 'There is 1 problem to fix before this can run');
  assert.equal(L.summaryHeading(3), 'There are 3 problems to fix before this can run');
  assert.equal(L.formatSize(0), '0 bytes');
  assert.equal(L.formatSize(1), '1 byte');
  assert.equal(L.formatSize(2048), '2.0 KiB');
  assert.equal(L.formatSize(3 * 1048576), '3.00 MiB');
  assert.equal(L.resultsUrl('abc-123'), '/results.html?id=abc-123');
  assert.equal(L.resultsUrl('a b&c'), '/results.html?id=a%20b%26c');
});

test('http failure messages are plain English', () => {
  assert.match(L.describeHttpFailure(429), /one analysis at a time/);
  assert.match(L.describeHttpFailure(403), /refused/);
  assert.match(L.describeHttpFailure(500), /terminal/);
  assert.equal(L.describeHttpFailure(404, { error: 'Run not found.' }), 'Run not found.');
  assert.match(L.describeHttpFailure(418, null), /status 418/);
});

test('safeBaseName keeps plain base names only', () => {
  assert.equal(L.safeBaseName('C:\\Users\\me\\model.txt'), 'model.txt');
  assert.equal(L.safeBaseName('../x/../y.txt'), 'y.txt');
  assert.equal(L.safeBaseName('a'.repeat(300)).length, 100);
  assert.equal(L.safeBaseName('..'), '');
  assert.equal(L.safeBaseName(undefined), '');
  const s = good(); s.model = { name: '', text: 'm' };
  assert.equal(L.buildRequest(s).names.model, undefined);
});

test('real demos load into form state and pass both validators', () => {
  const demos = listDemos().filter((d) => d.request);
  assert.ok(demos.length >= 2);
  for (const d of demos) {
    const s = L.stateFromDemo(d);
    if (d.id === 'coin') assert.deepEqual(L.validateForm(s), []);
    const r = L.buildRequest(s);
    assert.equal(r.inits.length, d.request.chains);
  }
});

// ---- HTML structure of run.html ----
const html = readFileSync(path.join(PUBLIC, 'run.html'), 'utf8');
const appJs = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test('run.html: every form control has a label, and described-by targets exist', () => {
  const controls = [...html.matchAll(/<(input|select)\b[^>]*\sid="([^"]+)"[^>]*>/g)];
  assert.ok(controls.length >= 9);
  for (const [, , id] of controls) assert.match(html, new RegExp(`<label for="${id}">`), `label for ${id}`);
  for (const [tag] of html.matchAll(/aria-describedby="([^"]+)"/g)) {
    for (const ref of tag.match(/"([^"]+)"/)[1].split(/\s+/)) assert.ok(ids.has(ref), `describedby ${ref}`);
  }
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.match(html, /<button type="submit"/);
  assert.equal((html.match(/<label for="/g) ?? []).length, controls.length);
});

test('run.html: error summary, aria-live status, file inputs, settings and chains selector', () => {
  assert.match(html, /id="error-summary"[^>]*aria-labelledby="error-summary-title"[^>]*hidden/);
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<input type="file" id="model"/);
  assert.match(html, /<input type="file" id="data"/);
  assert.match(html, /<select id="chains"/);
  for (const o of ['1', '2', '3', '4']) assert.match(html, new RegExp(`<option value="${o}"`));
  for (const f of ['burnIn', 'samples', 'thin', 'seed', 'timeoutS']) {
    assert.match(html, new RegExp(`id="${f}"`));
    assert.match(html, new RegExp(`id="hint-${f}"`));
    assert.match(html, new RegExp(`id="err-${f}"`));
  }
  assert.match(html, /id="monitors"/);
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /tabindex="[1-9]/, 'no positive tabindex');
  assert.doesNotMatch(html, /not available in this build yet/);
});

test('app.js: every element id it looks up exists in run.html; no HTML injection or remote calls', () => {
  for (const m of appJs.matchAll(/\$\('([A-Za-z-]+)'\)/g)) assert.ok(ids.has(m[1]) || ['inits-rows'].includes(m[1]), `id ${m[1]}`);
  for (const f of ['burnIn', 'samples', 'thin', 'seed', 'timeoutS', 'chains']) assert.ok(ids.has(`hint-${f}`));
  assert.doesNotMatch(appJs, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.doesNotMatch(appJs, /https?:\/\//);
  assert.match(appJs, /new FileReader\(\)/);
  assert.match(appJs, /fetch\('\/api\/demos'\)/);
  assert.match(appJs, /post\('\/api\/validate'/);
  assert.match(appJs, /post\('\/api\/runs'/);
  assert.match(appJs, /resultsUrl\(/);
  // validate is called before runs
  assert.ok(appJs.indexOf("post('/api/validate'") < appJs.indexOf("post('/api/runs'"));
});

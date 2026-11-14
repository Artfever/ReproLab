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

// ---- Results page (task 5.3): requirements 8.1 to 8.8 ----
import * as R from '../public/results-logic.js';
import { LOG_MAX_LINES as SRV_LINES, LOG_MAX_BYTES as SRV_BYTES, SUMMARY_LABEL as SRV_LABEL, RUN_STATES } from '../src/runs.mjs';

const RID = 'a'.repeat(32);
const runOf = (over = {}) => ({
  id: RID, state: 'succeeded', reason: 'engine finished and all expected files exist',
  settings: { burnIn: 1000, samples: 10000, thin: 1, seed: 1, timeoutS: 120, chains: 2, monitors: ['p'] },
  engineVersion: '3.2.3 rev 1012', runtimeS: 0.066, createdAt: '2026-01-01T00:00:00.000Z',
  files: [{ name: 'log.txt', bytes: 413, sha256: 'ab'.repeat(32) }],
  log: { lines: ['OpenBUGS version 3.2.3 rev 1012', 'model is syntactically correct'], truncated: false },
  summary: { available: true, label: 'x', nodes: { p: { mean: 0.66862377, sd: 0.12977736881005048, median: 0.6785, 'q2.5': 0.3934, 'q97.5': 0.8897, n: 20000 } } },
  ...over,
});

test('results: constants equal the server', () => {
  assert.equal(R.LOG_MAX_LINES, SRV_LINES);
  assert.equal(R.LOG_MAX_BYTES, SRV_BYTES);
  assert.equal(R.SUMMARY_LABEL, SRV_LABEL);
  assert.deepEqual([...R.ACTIVE_STATES, ...R.TERMINAL_STATES].sort(), [...RUN_STATES].sort());
  assert.ok(R.POLL_MS >= 1000 && R.POLL_MS <= 2000);
});

test('results: every run state has a visible word; unknown state is not shown as success', () => {
  for (const s of RUN_STATES) assert.ok(R.describeState(s).word.length > 0, s);
  assert.equal(R.describeState('succeeded').word, 'Succeeded');
  assert.equal(R.describeState('engine_error').word, 'Engine error');
  assert.equal(R.describeState('timed_out').word, 'Timed out');
  assert.equal(R.describeState('runner_error').word, 'Runner error');
  assert.equal(R.describeState('bogus').tone, 'bad');
  assert.equal(R.isActive('running'), true);
  assert.equal(R.isActive('queued'), true);
  assert.equal(R.isActive('succeeded'), false);
  assert.match(R.describeState('succeeded').text, /not a statement that the result is scientifically valid/);
});

test('results: run id from the query string accepts only a 32-hex id', () => {
  assert.equal(R.runIdFromSearch(`?id=${RID}`), RID);
  assert.equal(R.runIdFromSearch(`?x=1&id=${RID}`), RID);
  for (const bad of ['', '?', '?id=', '?id=../../x', '?id=%3Cimg%3E', `?id=${RID}0`, '?id=ABC', '?id=%E0%A4%A']) {
    assert.equal(R.runIdFromSearch(bad), null, bad);
  }
  assert.equal(R.manifestUrl(RID), `/api/runs/${RID}/manifest`);
  assert.equal(R.fileUrl(RID, 'a b.txt'), `/api/runs/${RID}/files/a%20b.txt`);
});

test('results: state changes are announced once', () => {
  assert.equal(R.announceState('running', null), 'Run state: Running.');
  assert.equal(R.announceState('running', 'running'), null);
  assert.equal(R.announceState('succeeded', 'running'), 'Run state changed from Running to Succeeded.');
});

test('results: details show engine version, settings, runtime and say "not reported" when missing', () => {
  const rows = Object.fromEntries(R.detailRows(runOf()));
  assert.equal(rows['Engine version'], '3.2.3 rev 1012');
  assert.equal(rows.Runtime, '0.066 s');
  assert.equal(rows.Samples, '10000');
  assert.equal(rows.Monitors, 'p');
  const none = Object.fromEntries(R.detailRows(runOf({ engineVersion: null, runtimeS: null, settings: {} })));
  assert.equal(none['Engine version'], 'not reported');
  assert.equal(none.Runtime, 'not reported');
  assert.equal(none.Chains, 'not reported');
});

test('results: the first engine error line is taken from the log, only for engine_error', () => {
  const log = { lines: ['OpenBUGS version 3.2.3 rev 1012', 'expected right parenthesis error pos 58 (error on line 4)', 'model must be syntactically correct before data can be loaded'], truncated: false };
  const bad = runOf({ state: 'engine_error', log, summary: null });
  assert.equal(R.firstEngineErrorLine(bad), 'expected right parenthesis error pos 58 (error on line 4)');
  const undef = runOf({ state: 'engine_error', log: { lines: ['variable gamma_missing is not defined'], truncated: false } });
  assert.equal(R.firstEngineErrorLine(undef), 'variable gamma_missing is not defined');
  assert.equal(R.firstEngineErrorLine(runOf({ log })), null, 'not shown for a succeeded run');
  assert.equal(R.firstEngineErrorLine(runOf({ state: 'engine_error', log: { lines: ['fine'], truncated: false } })), null);
});

test('results: a log within bounds has no note; line and byte bounds add the note', () => {
  assert.equal(R.boundLog({ lines: ['a', 'b'], truncated: false }).note, null);
  assert.equal(R.boundLog({ lines: [], truncated: false }).empty, true);
  assert.equal(R.boundLog(null).empty, true);
  const exact = R.boundLog({ lines: Array.from({ length: 2000 }, () => 'x'), truncated: false });
  assert.equal(exact.lines.length, 2000);
  assert.equal(exact.note, null);
  const over = R.boundLog({ lines: Array.from({ length: 2001 }, () => 'x'), truncated: false });
  assert.equal(over.lines.length, 2000);
  assert.match(over.note, /first 2000 lines or 256 KiB/);
  const server = R.boundLog({ lines: ['a'], truncated: true });
  assert.match(server.note, /longer than this page shows/);
  const wide = R.boundLog({ lines: Array.from({ length: 10 }, () => 'y'.repeat(40000)), truncated: false });
  assert.ok(wide.lines.length < 10);
  assert.ok(wide.note);
});

test('results: log text with HTML stays text (the module only returns strings)', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const b = R.boundLog({ lines: [evil, '</pre><script>x</script>'], truncated: false });
  assert.deepEqual(b.lines, [evil, '</pre><script>x</script>']);
  const run = runOf({ state: 'engine_error', reason: evil, log: { lines: [evil, 'x is not defined'], truncated: false }, files: [{ name: evil, bytes: 1, sha256: evil }] });
  assert.equal(R.reasonText(run), evil);
  assert.equal(R.fileRows(run)[0].name, evil);
  assert.equal(typeof R.fileRows(run)[0].sha256, 'string');
});

test('results: file rows show name, size and SHA-256', () => {
  const rows = R.fileRows(runOf({ files: [{ name: 'a.txt', bytes: 2048, sha256: 'f'.repeat(64) }, { name: 'b.txt', bytes: 0, sha256: 'e3b0' }, null, { bytes: 1 }] }));
  assert.deepEqual(rows, [
    { name: 'a.txt', size: '2.0 KiB', sha256: 'f'.repeat(64) },
    { name: 'b.txt', size: '0 bytes', sha256: 'e3b0' },
  ]);
  assert.deepEqual(R.fileRows(runOf({ files: undefined })), []);
});

test('results: summary table carries the required label; label never comes from the response', () => {
  const v = R.summaryView(runOf());
  assert.equal(v.kind, 'table');
  assert.equal(v.label, 'Computed by ReproLab from the exported samples. Not a convergence or validity claim.');
  assert.deepEqual(v.rows[0], ['p', '0.6686', '0.1298', '0.6785', '0.3934', '0.8897', '20000']);
  const sneaky = R.summaryView(runOf({ summary: { available: true, label: 'Validated and converged', nodes: { p: { mean: 1 } } } }));
  assert.equal(sneaky.label, R.SUMMARY_LABEL);
  assert.equal(sneaky.rows[0][1], '1');
  assert.equal(sneaky.rows[0][2], 'n/a');
});

test('results: summary absent or failed shows the reason and no numbers', () => {
  const failed = R.summaryView(runOf({ summary: { available: false, reason: 'The summary command failed.' } }));
  assert.equal(failed.kind, 'unavailable');
  assert.equal(failed.message, 'The summary command failed.');
  assert.equal(failed.rows, undefined);
  const missing = R.summaryView(runOf({ summary: null }));
  assert.equal(missing.kind, 'unavailable');
  assert.match(missing.message, /No summary was computed/);
  const nonSuccess = R.summaryView(runOf({ state: 'engine_error', summary: { available: true, nodes: { p: { mean: 1 } } } }));
  assert.equal(nonSuccess.kind, 'none');
  assert.equal(R.summaryView(runOf({ summary: { available: true, nodes: {} } })).kind, 'unavailable');
});

test('results: fetch failures are plain English', () => {
  assert.match(R.describeFetchFailure(404), /not found/);
  assert.match(R.describeFetchFailure(403), /refused/);
  assert.match(R.describeFetchFailure(500), /terminal/);
  assert.match(R.describeFetchFailure(418), /status 418/);
});

const rhtml = readFileSync(path.join(PUBLIC, 'results.html'), 'utf8');
const rjs = readFileSync(path.join(PUBLIC, 'results.js'), 'utf8');
const rlogic = readFileSync(path.join(PUBLIC, 'results-logic.js'), 'utf8');
const rids = new Set([...rhtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test('results.html: live region, table caption and scope, manifest link, assistant slot, no inline script', () => {
  assert.match(rhtml, /id="announce"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(rhtml, /<caption>Files written by this run/);
  assert.match(rhtml, /<th scope="col">SHA-256<\/th>/);
  assert.match(rhtml, /id="manifest-link"[^>]*download="manifest.json"/);
  assert.match(rhtml, /<div id="assistant-slot"><\/div>/);
  assert.match(rhtml, /<script type="module" src="\/results\.js"><\/script>/);
  assert.doesNotMatch(rhtml, /not available in this build yet/);
  assert.doesNotMatch(rhtml, /tabindex="[1-9]/);
  assert.equal((rhtml.match(/<h1[\s>]/g) ?? []).length, 1);
});

test('results.js: every id it looks up exists; textContent only; no remote calls', () => {
  for (const m of rjs.matchAll(/\$\('([A-Za-z-]+)'\)/g)) assert.ok(rids.has(m[1]), `id ${m[1]}`);
  for (const src of [rjs, rlogic]) {
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
    assert.doesNotMatch(src, /https?:\/\//);
  }
  assert.match(rjs, /setTimeout\(\(\) => poll\(id\), POLL_MS\)/);
  assert.match(rjs, /\$\('log'\)\.textContent = /);
});

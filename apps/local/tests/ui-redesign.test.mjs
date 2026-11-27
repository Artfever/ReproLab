// Spec 05-ui-redesign: hash tags, run timeline, sample plot, NumPy volume and the recorded data on Home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../public/results-logic.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '..', 'public');
const REPO = path.resolve(HERE, '..', '..', '..');
const read = (f) => readFileSync(path.join(PUBLIC, f), 'utf8');
const SHA = '61cf508305c691626bdda15f5a48502691c2491d8a1871b10464957886749220';

// ---- hash tag ----
test('shortHash keeps the full hash and shows the first eight characters', () => {
  assert.deepEqual(R.shortHash(SHA), { algo: 'sha256', short: '61cf5083…', full: SHA });
  for (const bad of ['', 'abc', SHA.toUpperCase(), `${SHA}0`, null, 42, '<u>y</u>']) assert.equal(R.shortHash(bad), null, String(bad));
});

// ---- timeline ----
test('SUCCESS_MARKERS equals REQUIRED_SUCCESS_MARKERS in adapter.py, in order', () => {
  const py = readFileSync(path.join(REPO, 'services/runner/reprolab_runner/adapter.py'), 'utf8');
  const block = /REQUIRED_SUCCESS_MARKERS = \(([\s\S]*?)\)/.exec(py)[1];
  const fromPy = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...R.SUCCESS_MARKERS], fromPy);
});

const coin = JSON.parse(readFileSync(path.join(REPO, 'docs/evidence/local-product/m2-coin-run.json'), 'utf8'));
const statuses = (t) => t.steps.map((s) => s.status);

test('timeline: the recorded Coin run lights all seven steps', () => {
  const t = R.timelineFromLog({ ...coin, engine: 'openbugs' });
  assert.equal(t.kind, 'markers');
  assert.deepEqual(statuses(t), Array(7).fill('done'));
  assert.ok(t.steps.every((s) => s.word === 'Done'));
});

test('timeline: an engine error stops at the first missing marker, for every stage', () => {
  for (let k = 0; k < 7; k += 1) {
    const lines = ['OpenBUGS version 3.2.3 rev 1012', ...R.SUCCESS_MARKERS.slice(0, k), 'variable gamma_missing is not defined'];
    const t = R.timelineFromLog({ state: 'engine_error', engine: 'openbugs', log: { lines } });
    const want = [...Array(k).fill('done'), 'failed', ...Array(6 - k).fill('pending')];
    assert.deepEqual(statuses(t), want, `stage ${k}`);
    assert.equal(t.steps[k].word, 'Stopped here');
  }
});

test('timeline: the recorded syntax error stops at the first step', () => {
  const lines = readFileSync(path.join(REPO, 'docs/evidence/bad-syntax/log.txt'), 'utf8').split(/\r?\n/);
  const t = R.timelineFromLog({ state: 'engine_error', engine: 'openbugs', log: { lines } });
  assert.equal(t.steps[0].status, 'failed');
});

test('timeline: the recorded timeout stops after the model was initialised', () => {
  const lines = readFileSync(path.join(REPO, 'docs/evidence/timeout-live/log.txt'), 'utf8').split(/\r?\n/);
  const t = R.timelineFromLog({ state: 'timed_out', engine: 'openbugs', log: { lines } });
  assert.deepEqual(statuses(t).slice(0, 4), ['done', 'done', 'done', 'done']);
  assert.equal(statuses(t).filter((s) => s === 'failed').length, 1);
  assert.equal(t.steps.findIndex((s) => s.status === 'failed'), 4);
});

test('timeline: markers out of order do not count, running is waiting, unknown is not success', () => {
  const swapped = ['data loaded', 'model is syntactically correct'];
  assert.deepEqual(statuses(R.timelineFromLog({ state: 'engine_error', log: { lines: swapped } })).slice(0, 2), ['done', 'failed']);
  const running = R.timelineFromLog({ state: 'running', log: { lines: ['model is syntactically correct'] } });
  assert.deepEqual(statuses(running).slice(0, 3), ['done', 'active', 'pending']);
  assert.equal(running.steps[1].word, 'Waiting');
  const unknown = R.timelineFromLog({ state: 'bogus', log: { lines: [] } });
  assert.equal(unknown.steps[0].status, 'failed');
  const truncated = R.timelineFromLog({ state: 'succeeded', log: { lines: R.SUCCESS_MARKERS.slice(0, 5) } });
  assert.deepEqual(statuses(truncated).slice(4), ['done', 'pending', 'pending'], 'a truncated success log is never shown as stopped');
});

test('timeline: fixture engines get coarse steps from the state', () => {
  const s = (state, files = []) => statuses(R.timelineFromLog({ state, engine: 'pymc2', files }));
  assert.deepEqual(s('queued'), ['active', 'pending', 'pending']);
  assert.deepEqual(s('running'), ['done', 'active', 'pending']);
  assert.deepEqual(s('succeeded', [{ name: 'traces.csv' }]), ['done', 'done', 'done']);
  assert.deepEqual(s('engine_error'), ['done', 'failed', 'pending']);
  assert.equal(R.timelineFromLog({ state: 'running', engine: 'caffe' }).kind, 'coarse');
});

test('run sheet keeps execution and comparison apart', () => {
  const rows = Object.fromEntries(R.runSheetRows({ ...coin, engine: 'openbugs', comparison: { status: 'passed', absoluteTolerance: 0.01 } }));
  assert.equal(rows.Engine, 'OpenBUGS 3.2.3 rev 1012');
  assert.match(rows.Comparison, /^passed against fixed expected values, tolerance 0\.01$/);
  assert.equal(Object.fromEntries(R.runSheetRows({ state: 'succeeded' })).Comparison, 'none for this run');
  assert.match(Object.fromEntries(R.runSheetRows(coin)).Created, /UTC$/);
});

// ---- plot ----
const chain = (vals, start = 1001) => vals.map((v, i) => `${start + i}\t${v}`).join('\n');
test('parseCoda reads index and chains and rejects anything else', () => {
  const out = R.parseCoda('p\t1\t4\n', [chain([0.5, 0.6, 0.7, 0.8]), chain([0.4, 0.5, 0.6, 0.65])]);
  assert.deepEqual(out.nodes.map((n) => n.name), ['p']);
  assert.deepEqual(out.nodes[0].chains, [[0.5, 0.6, 0.7, 0.8], [0.4, 0.5, 0.6, 0.65]]);
  const two = R.parseCoda('a 1 2\nb 3 4', [chain([1, 2, 3, 4])]);
  assert.deepEqual(two.nodes[1].chains[0], [3, 4]);
  assert.deepEqual(R.parseCoda('p 1 1', ['1 9.654E-4']).nodes[0].chains[0], [0.0009654]);
  for (const [idx, ch] of [['', [chain([1])]], ['p 1 2', [chain([1])]], ['p 2 1', [chain([1, 2])]], ['p 1 1', ['1 x']], ['<b> 1 1', ['1 1']], ['p 1 1', []], ['p 1 300000', [chain([1])]]]) {
    assert.throws(() => R.parseCoda(idx, ch), Error, JSON.stringify([idx, ch]));
  }
});

test('parseTracesCsv reads the PyMC 2 trace format', () => {
  const out = R.parseTracesCsv('chain,draw,p\n0,0,0.5\n0,1,0.6\n1,0,0.7\n');
  assert.deepEqual(out.nodes[0], { name: 'p', chains: [[0.5, 0.6], [0.7]] });
  assert.throws(() => R.parseTracesCsv('a,b\n1,2'));
  assert.throws(() => R.parseTracesCsv('chain,draw,p\n0,0,nope'));
});

test('histogram counts every sample once and its density integrates to 1', () => {
  const s = Array.from({ length: 1000 }, (_, i) => i / 999);
  const h = R.histogram([s, s.slice(0, 500)], 20, [0, 1]);
  assert.equal(h.counts[0].reduce((a, b) => a + b, 0), 1000);
  assert.equal(h.counts[1].reduce((a, b) => a + b, 0), 500);
  assert.ok(Math.abs(h.density[0].reduce((a, d) => a + d * h.width, 0) - 1) < 1e-9);
  assert.throws(() => R.histogram([[1, Number.NaN]]));
});

test('betaPdf is the Beta(8, 4) density of the Coin toy model', () => {
  let area = 0;
  for (let i = 0; i < 10000; i += 1) area += R.betaPdf((i + 0.5) / 10000, 8, 4) / 10000;
  assert.ok(Math.abs(area - 1) < 1e-6, String(area));
  // 0.7^7 * 0.3^3 / B(8, 4), with B(8, 4) = 7! 3! / 11! = 1/1320
  assert.ok(Math.abs(R.betaPdf(0.7, 8, 4) - 0.7 ** 7 * 0.3 ** 3 * 1320) < 1e-9, String(R.betaPdf(0.7, 8, 4)));
  assert.equal(R.betaPdf(1.2, 8, 4), 0);
  assert.equal(R.betaPdf(0.5, 0, 4), 0);
});

test('exactBetaFor recovers Beta(8, 4) from the Coin comparison and nothing else', () => {
  const expected = { mean: 2 / 3, sd: Math.sqrt(2 / 117), draws: 20000 };
  assert.deepEqual(R.exactBetaFor({ engine: 'openbugs', comparison: { status: 'passed', expected } }), { a: 8, b: 4 });
  assert.deepEqual(R.exactBetaFor({ engine: 'pymc2', comparison: { expected } }), { a: 8, b: 4 });
  assert.equal(R.exactBetaFor({ engine: 'openbugs', comparison: null }), null);
  assert.equal(R.exactBetaFor({ engine: 'caffe', comparison: { expected } }), null);
  assert.equal(R.exactBetaFor({ engine: 'openbugs', comparison: { expected: { mean: 1.5, sd: 0.1 } } }), null);
});

// ---- NumPy volume ----
function npy(descr, shape, values, { fortran = 'False', version = 1, bytes = 4 } = {}) {
  let header = `{'descr': '${descr}', 'fortran_order': ${fortran}, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;
  const pre = version === 1 ? 10 : 12;
  header += ' '.repeat((64 - ((pre + header.length + 1) % 64)) % 64) + '\n';
  const buf = new ArrayBuffer(pre + header.length + values.length * bytes);
  const u8 = new Uint8Array(buf);
  u8.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, version, 0]);
  const dv = new DataView(buf);
  if (version === 1) dv.setUint16(8, header.length, true); else dv.setUint32(8, header.length, true);
  for (let i = 0; i < header.length; i += 1) u8[pre + i] = header.charCodeAt(i);
  values.forEach((v, i) => { if (bytes === 4) dv.setFloat32(pre + header.length + i * 4, v, true); else dv.setFloat64(pre + header.length + i * 8, v, true); });
  return buf;
}

test('parseNpy reads the NiftyNet fixture shape (2, 3, 4) as float32 and float64', () => {
  const vals = Array.from({ length: 24 }, (_, i) => i * 2);
  const a = R.parseNpy(npy('<f4', [2, 3, 4], vals));
  assert.deepEqual(a.shape, [2, 3, 4]);
  assert.deepEqual([...a.data], vals);
  assert.equal(vals.reduce((x, y) => x + y, 0), 552, 'same sum as the engines.mjs reference');
  const b = R.parseNpy(npy('<f8', [2, 3, 4], vals, { version: 2, bytes: 8 }));
  assert.deepEqual([...b.data], vals);
  const s = R.volumeSlice(a, 1);
  assert.equal(s.depth, 2);
  assert.deepEqual(s.rows[0], [24, 26, 28, 30]);
  assert.equal(s.max, 46);
});

test('parseNpy rejects bad magic, Fortran order, unknown types, short data and large files', () => {
  const good = npy('<f4', [2, 2], [1, 2, 3, 4]);
  const badMagic = good.slice(0); new Uint8Array(badMagic)[1] = 0;
  assert.throws(() => R.parseNpy(badMagic), /Not a NumPy/);
  assert.throws(() => R.parseNpy(npy('<f4', [2, 2], [1, 2, 3, 4], { fortran: 'True' })), /C-ordered/);
  assert.throws(() => R.parseNpy(npy('<c8', [2, 2], [1, 2, 3, 4])), /not supported/);
  assert.throws(() => R.parseNpy(good.slice(0, good.byteLength - 4)), /shorter/);
  assert.throws(() => R.parseNpy(new ArrayBuffer(R.NPY_MAX_BYTES + 1)), /not usable/);
  assert.throws(() => R.parseNpy('not a buffer'), /not usable/);
});

// ---- Home shows recorded data exactly ----
test('Home: the specimen hash and the replayed log equal the recorded Coin run', () => {
  const html = read('index.html');
  const chain1 = coin.files.find((f) => f.name === 'coda_CODAchain1.txt');
  assert.match(html, new RegExp(`id="specimen-hash-text">${chain1.sha256}<`));
  const pre = /<pre class="terminal" id="replay-log"[^>]*>([\s\S]*?)<\/pre>/.exec(html)[1];
  assert.equal(pre, coin.log.lines.join('\n'));
  assert.match(html, /Recorded run from docs\/evidence, replayed\. Nothing is running now\./);
  assert.match(read('home.js'), /bytes: '129,880 bytes/);
  assert.equal(chain1.bytes, 129880);
});

test('How it works: the hashes in the pipeline figure are recorded Coin hashes', () => {
  const html = read('how-it-works.html');
  for (const [name, short] of [...html.matchAll(/(coda_CODA\w+\.txt)\s+sha256 ([0-9a-f]{8})…/g)].map((m) => [m[1], m[2]])) {
    assert.ok(coin.files.find((f) => f.name === name)?.sha256.startsWith(short), name);
  }
});

// ---- motion and library boundaries ----
const pages = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
const scripts = readdirSync(PUBLIC).filter((f) => f.endsWith('.js'));

test('every page loads the shared shell and GSAP from this origin', () => {
  for (const p of pages) {
    const html = read(p);
    assert.match(html, /<script src="\/vendor\/gsap-3\.15\.1\/gsap\.min\.js" defer><\/script>/, p);
    assert.match(html, /<script type="module" src="\/site\.js"><\/script>/, p);
    assert.match(html, /<details class="nav-menu" open>/, p);
    assert.equal((html.match(/<body>/g) ?? []).length, 1, p);
  }
});

test('three.js is imported only by the specimen case and the volume viewer', () => {
  const users = scripts.filter((f) => /three-0\.187\.0/.test(read(f)));
  assert.deepEqual(users.sort(), ['specimen.js', 'volume-viewer.js']);
  assert.match(read('home.js'), /import\('\/specimen\.js'\)/);
  assert.match(read('results.js'), /import\('\/volume-viewer\.js'\)/);
});

test('new scripts insert text only, name no remote URL and never loop motion', () => {
  for (const f of ['motion.js', 'motion-logic.js', 'site.js', 'home.js', 'specimen.js', 'how-it-works.js', 'docs.js', 'volume-viewer.js', 'results.js', 'app.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
    assert.doesNotMatch(src, /https?:\/\//, f);
    assert.doesNotMatch(src, /repeat:\s*-1|yoyo|requestAnimationFrame\(\s*(loop|tick|animate)/, f);
  }
});

test('the plot and the timeline carry their honesty labels', () => {
  const html = read('results.html');
  assert.match(html, /<figcaption id="sample-plot-caption">Plot of exported samples\. Not a convergence diagnostic\.<\/figcaption>/);
  assert.match(html, /A step is marked done only when its line appears in the engine log\./);
  assert.match(read('results.js'), /Exact posterior for this toy model/);
});

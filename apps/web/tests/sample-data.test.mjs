import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generate, serialize, OUT_PATH, REPO_ROOT } from '../scripts/build-sample-data.mjs';
import { validateSampleRun } from '../src/lib/sample-run-schema.mjs';

const committed = () => JSON.parse(readFileSync(OUT_PATH, 'utf8'));
const clone = () => structuredClone(committed());

test('committed sample-run.json equals what the generator produces from the evidence (no drift)', () => {
  assert.equal(readFileSync(OUT_PATH, 'utf8'), serialize(generate()));
});

test('committed sample-run.json passes the schema', () => {
  assert.deepEqual(validateSampleRun(committed()), { ok: true });
});

test('pre-declared comparison is recorded as failing on all five nodes; post hoc ones are labelled', () => {
  const d = committed();
  const pre = d.comparisons.filter((c) => c.kind === 'pre_declared');
  assert.equal(pre.length, 2);
  assert.ok(pre.every((c) => c.overall.result === 'fail' && c.overall.nodes_failed === 5));
  const long = d.comparisons.find((c) => c.id === 'seeds-longburn-pooled-20000');
  assert.equal(long.kind, 'post_hoc');
});

test('every claim has existing, non-empty evidence files', () => {
  for (const c of committed().claims) {
    assert.ok(c.evidence.length > 0, c.id);
    for (const e of c.evidence) {
      const p = path.join(REPO_ROOT, e);
      assert.ok(existsSync(p) && readFileSync(p).length > 0, `${c.id}: ${e}`);
    }
  }
});

test('input hashes are the same in every successful run', () => {
  const d = committed();
  for (const f of d.inputs) for (const r of d.runs.filter((x) => x.name.startsWith('seeds-'))) {
    assert.equal(r.inputs.find((i) => i.name === f.name).sha256, f.sha256, `${r.name} ${f.name}`);
  }
});

const mutations = {
  'missing schema_version': (d) => { delete d.schema_version; },
  'bad hash (uppercase)': (d) => { d.runs[0].outputs[0].sha256 = d.runs[0].outputs[0].sha256.toUpperCase(); },
  'bad run status': (d) => { d.runs[0].status = 'ok'; },
  'run order changed': (d) => { d.runs.reverse(); },
  'comparison row removed': (d) => { d.comparisons[0].rows.pop(); },
  'pre-declared made to pass': (d) => { d.comparisons[0].overall = { result: 'pass', nodes_failed: 0, nodes_total: 5 }; },
  'pre-declared reclassified': (d) => { d.comparisons[0].kind = 'post_hoc'; },
  'NaN-like runtime': (d) => { d.runs[0].runtime_s = 'fast'; },
  'claim without evidence': (d) => { d.claims[0].evidence = []; },
  'limitation cites unknown claim': (d) => { d.limitations[0].claim_ids = ['nope']; },
  'image marked pushed': (d) => { d.engine.image_pushed = true; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`schema rejects: ${name}`, () => {
    const d = clone();
    mutate(d);
    assert.equal(validateSampleRun(d).ok, false);
  });
}
test('schema rejects non-objects', () => {
  for (const v of [null, 5, 'x', [], undefined]) assert.equal(validateSampleRun(v).ok, false);
});
// Builds apps/web/content/sample-run.json from the committed evidence files.
// Dependency-free. Deterministic: no timestamps. Usage: node scripts/build-sample-data.mjs --write | --check
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './authored.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const OUT_PATH = path.resolve(here, '..', 'content', 'sample-run.json');
const NODES = ['alpha0', 'alpha1', 'alpha12', 'alpha2', 'sigma'];
const HEX64 = /^[0-9a-f]{64}$/;

function fail(file, msg) { throw new Error(`${file}: ${msg}`); }

export function generate(root = REPO_ROOT) {
  const used = new Map();
  const read = (rel) => {
    const p = path.join(root, rel);
    if (!existsSync(p)) fail(rel, 'file is missing');
    const buf = readFileSync(p);
    if (buf.length === 0) fail(rel, 'file is empty');
    const text = buf.toString('utf8').replace(/\r\n/g, '\n');
    used.set(rel, { path: rel, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length });
    return text;
  };
  const readJson = (rel) => { try { return JSON.parse(read(rel)); } catch (e) { if (e instanceof SyntaxError) fail(rel, 'not valid JSON'); throw e; } };
  const ev = 'docs/evidence/';

  // manifests
  const manifests = {};
  for (const run of A.RUN_ORDER) {
    const m = readJson(`${ev}${run}/manifest.json`);
    for (const k of ['engine_version', 'exit_code', 'files', 'image_digest', 'n_chains', 'reason', 'runtime_s', 'settings', 'status']) {
      if (!(k in m)) fail(`${ev}${run}/manifest.json`, `key "${k}" is missing`);
    }
    if (!['succeeded', 'failed', 'timed_out'].includes(m.status)) fail(`${ev}${run}/manifest.json`, `status "${m.status}" is not allowed`);
    for (const [name, f] of Object.entries(m.files)) if (!HEX64.test(f.sha256)) fail(`${ev}${run}/manifest.json`, `hash for ${name} is not 64 lowercase hex`);
    manifests[run] = m;
  }
  const imageIds = new Set(Object.values(manifests).map((m) => m.image_digest));
  if (imageIds.size !== 1) fail(ev, 'runs used different image digests');
  const engineVersions = new Set(Object.values(manifests).map((m) => m.engine_version));
  if (engineVersions.size !== 1 || !engineVersions.has('3.2.3 rev 1012')) fail(ev, 'engine version is not 3.2.3 rev 1012 in every run');

  // logs
  const logs = {};
  for (const run of A.RUN_ORDER) logs[run] = read(`${ev}${run}/log.txt`).split('\n');

  // inputs (good runs must agree)
  const good = ['seeds-a', 'seeds-b', 'seeds-c', 'seeds-longburn'];
  const upstream = {};
  for (const line of read(`${ev}input_hashes_upstream_examples.txt`).split('\n')) {
    const m = /^([0-9a-f]{64})\s+(\S+)$/.exec(line.trim());
    if (m) upstream[m[1]] = m[2];
  }
  const inputs = Object.entries(A.INPUT_ROLE).map(([name, expectedUpstream]) => {
    const f0 = manifests['seeds-a'].files[name];
    if (!f0) fail(`${ev}seeds-a/manifest.json`, `no entry for ${name}`);
    for (const r of good) if (manifests[r].files[name]?.sha256 !== f0.sha256) fail(`${ev}${r}/manifest.json`, `${name} hash differs from seeds-a`);
    if (upstream[f0.sha256] !== expectedUpstream) fail(`${ev}input_hashes_upstream_examples.txt`, `${name} does not match ${expectedUpstream}`);
    return { name, upstream_name: upstream[f0.sha256], bytes: f0.bytes, sha256: f0.sha256, rights_status: A.RIGHTS };
  });

  // runs
  const INPUT_NAMES = ['model.txt', 'data.txt', 'inits1.txt', 'inits2.txt'];
  const runs = A.RUN_ORDER.map((name) => {
    const m = manifests[name];
    const outputs = Object.entries(m.files).filter(([n]) => !INPUT_NAMES.includes(n) && !['data.txt', 'inits1.txt', 'inits2.txt', 'model.txt'].includes(n))
      .map(([n, f]) => ({ name: n, bytes: f.bytes, sha256: f.sha256 })).sort((a, b) => a.name.localeCompare(b.name));
    const ins = INPUT_NAMES.filter((n) => m.files[n]).map((n) => ({ name: n, bytes: m.files[n].bytes, sha256: m.files[n].sha256 }));
    if (m.status === 'failed') {
      const m2 = /^engine reported a problem: (.*)$/.exec(m.reason);
      if (!m2 || !logs[name].includes(m2[1])) fail(`${ev}${name}/manifest.json`, 'failure reason is not a line of the log');
    }
    return {
      name, purpose: A.RUN_PURPOSE[name], status: m.status, reason: m.reason, exit_code: m.exit_code, runtime_s: m.runtime_s,
      engine_version: m.engine_version, image_id: m.image_digest, chains: m.n_chains, burn_in: m.settings.burn_in, samples: m.settings.samples,
      thin: m.settings.thin, seed: m.settings.seed, timeout_s: m.settings.timeout_s, monitors: m.settings.monitors, outputs, inputs: ins,
    };
  });

  // comparisons
  const sections = read(`${ev}comparisons.txt`).split(/^##### /m).slice(1);
  const parsed = {};
  for (const s of sections) {
    const nl = s.indexOf('\n');
    const head = /^(.*) \(exit=(\d+), expected (\d+)\)$/.exec(s.slice(0, nl));
    if (!head) fail(`${ev}comparisons.txt`, 'a section header has no (exit=N, expected M)');
    let rows;
    try { rows = JSON.parse(s.slice(nl + 1)); } catch { fail(`${ev}comparisons.txt`, `section "${head[1]}" is not valid JSON`); }
    parsed[head[1]] = { exit: Number(head[2]), expected: Number(head[3]), rows };
  }
  const near = (a, b) => Math.abs(a - b) <= 1e-9;
  const comparisons = A.COMPARISONS.map((c) => {
    const sec = parsed[c.header];
    if (!sec) fail(`${ev}comparisons.txt`, `no section headed "${c.header}"`);
    if (sec.rows.length !== 5) fail(`${ev}comparisons.txt`, `section "${c.header}" does not have 5 rows`);
    const rows = sec.rows.map((r) => {
      const row = { node: r.node, ref_mean: r.ref_mean, mean: r.mean, d_mean: r.d_mean, mean_tol: r.mean_tol, mean_ok: r.mean_ok,
        ref_sd: r.ref_sd, sd: r.sd, d_sd: r.d_sd, sd_tol: r.sd_tol, sd_ok: r.sd_ok, ok: r.ok };
      if (!NODES.includes(row.node)) fail(`${ev}comparisons.txt`, `unknown node ${row.node}`);
      if (!near(row.d_mean, row.mean - row.ref_mean) || !near(row.d_sd, row.sd - row.ref_sd)) fail(`${ev}comparisons.txt`, `${c.id}/${row.node}: difference is not arithmetically consistent`);
      if (row.mean_ok !== (Math.abs(row.d_mean) <= row.mean_tol) || row.sd_ok !== (Math.abs(row.d_sd) <= row.sd_tol) || row.ok !== (row.mean_ok && row.sd_ok)) fail(`${ev}comparisons.txt`, `${c.id}/${row.node}: pass/fail flags are not consistent`);
      if (!near(row.sd_tol, 0.1 * row.ref_sd)) fail(`${ev}comparisons.txt`, `${c.id}/${row.node}: sd tolerance is not 10% of the published sd`);
      return row;
    });
    const failed = rows.filter((r) => !r.ok).length;
    const result = failed === 0 ? 'pass' : 'fail';
    if ((result === 'pass') !== (sec.exit === 0)) fail(`${ev}comparisons.txt`, `${c.id}: overall result disagrees with exit code ${sec.exit}`);
    if (sec.exit !== sec.expected) fail(`${ev}comparisons.txt`, `${c.id}: exit code differs from the expected one`);
    return { id: c.id, label: c.header, kind: c.kind, run: c.run, setting: c.setting, exit_code: sec.exit, expected_exit_code: sec.expected,
      rows, overall: { result, nodes_failed: failed, nodes_total: 5 }, note: c.note };
  });
  const pre = comparisons.find((c) => c.id === 'seeds-a-pooled-1000');
  if (!pre || pre.overall.nodes_failed !== 5) fail(`${ev}comparisons.txt`, 'the pre-declared comparison no longer fails on all five nodes');

  // published baseline + MC error tolerance cross-check
  const pub = readJson('services/runner/reference/seeds_published.json');
  for (const c of comparisons) for (const r of c.rows) {
    const p = pub.nodes[r.node];
    if (!p || p.mean !== r.ref_mean || p.sd !== r.ref_sd || !near(r.mean_tol, 4 * p.mc_error)) fail(`${ev}comparisons.txt`, `${c.id}/${r.node}: does not match the published baseline file (mean, sd, 4 x MC error)`);
  }

  // output summary
  const ps = readJson(`${ev}seeds-longburn/pooled_summary.json`);
  const lb = manifests['seeds-longburn'];
  const longComp = comparisons.find((c) => c.id === 'seeds-longburn-pooled-20000');
  const summaryNodes = {};
  for (const n of NODES) {
    const s = ps[n];
    if (!s) fail(`${ev}seeds-longburn/pooled_summary.json`, `no node ${n}`);
    if (s.n !== lb.n_chains * lb.settings.samples) fail(`${ev}seeds-longburn/pooled_summary.json`, `${n}: n is not chains x samples`);
    const row = longComp.rows.find((r) => r.node === n);
    if (!near(row.mean, s.mean) || !near(row.sd, s.sd)) fail(`${ev}seeds-longburn/pooled_summary.json`, `${n}: mean or sd differs from the longburn comparison`);
    summaryNodes[n] = { mean: s.mean, sd: s.sd, median: s.median, q2_5: s['q2.5'], q97_5: s['q97.5'], n: s.n };
  }

  // reproducibility
  const same = (r1, r2) => A.REPRO_FILES.map((file) => ({ file, identical: manifests[r1].files[file]?.sha256 === manifests[r2].files[file]?.sha256 && !!manifests[r1].files[file] }));
  const reproducibility = { seeds_a_vs_b: same('seeds-a', 'seeds-b'), seeds_c_vs_a: same('seeds-c', 'seeds-a'), scope: 'one image, one machine' };
  if (!reproducibility.seeds_a_vs_b.every((x) => x.identical)) fail(ev, 'seeds-a and seeds-b are not byte-identical in every compared file');
  if (!reproducibility.seeds_c_vs_a.some((x) => !x.identical)) fail(ev, 'seeds-c (seed 2) is not different from seeds-a');

  // program output
  const program_output = A.PROGRAM_OUTPUT.map((p) => {
    const i = logs[p.run].indexOf(p.text);
    if (i < 0) fail(`${ev}${p.run}/log.txt`, `no line equals "${p.text}"`);
    return { run: p.run, line_no: i + 1, text: p.text };
  });

  // claims
  const claims = A.CLAIMS.map((c) => {
    if (!c.evidence.length) fail('authored.mjs', `claim ${c.id} has no evidence`);
    for (const a of c.asserted) {
      const text = read(a.path);
      let ok = false;
      if (a.kind === 'contains') ok = text.includes(a.detail);
      else if (a.kind === 'line_equals') ok = text.split('\n').includes(a.detail);
      else if (a.kind === 'json_eq') {
        const [k, v] = a.detail.split('=');
        const val = JSON.parse(text)[k];
        ok = String(val) === v;
      }
      if (!ok) fail(a.path, `claim ${c.id}: assertion ${a.kind} "${a.detail}" is false`);
    }
    for (const e of c.evidence) read(e);
    return { id: c.id, page: c.page, text: c.text, evidence: c.evidence, asserted: c.asserted };
  });
  const ids = new Set(claims.map((c) => c.id));
  for (const l of [...A.LIMITATIONS, ...A.STATUS_FACTS]) for (const id of l.claim_ids) if (!ids.has(id)) fail('authored.mjs', `${l.id} cites unknown claim ${id}`);

  return {
    schema_version: 1,
    generated_from: [...used.values()].sort((a, b) => a.path.localeCompare(b.path)),
    engine: { name: 'OpenBUGS', version: '3.2.3 rev 1012', image_id: [...imageIds][0], image_pushed: false },
    model_summary: A.MODEL_SUMMARY,
    published_baseline: { source: pub.source, settings: pub.settings, transcribed_by: pub.transcribed_by, nodes: pub.nodes },
    tolerance_rule: A.TOLERANCE_RULE,
    inputs, runs, comparisons,
    output_summary: { run: 'seeds-longburn', label: "Computed by ReproLab from the exported samples, not copied from the engine's printed table", nodes: summaryNodes },
    reproducibility, program_output,
    limitations: A.LIMITATIONS, status_facts: A.STATUS_FACTS, claims,
  };
}

export function serialize(obj) { return JSON.stringify(obj, null, 2) + '\n'; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  try {
    const text = serialize(generate());
    if (mode === '--write') { writeFileSync(OUT_PATH, text); console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`); }
    else if (mode === '--check') {
      const cur = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : '';
      if (cur !== text) { console.error('content/sample-run.json is out of date. Run: npm run data'); process.exit(1); }
      console.log('sample-run.json matches the evidence');
    } else { console.error('usage: --write | --check'); process.exit(2); }
  } catch (e) { console.error(`sample data error: ${e.message}`); process.exit(1); }
}
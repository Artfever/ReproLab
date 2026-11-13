// Validates the shape of content/sample-run.json. Returns { ok: true } or { ok: false, field }.
// Used by the build (scripts/validate-sample-data.mjs), the page loader and the tests. No dependencies.
const HEX64 = /^[0-9a-f]{64}$/;
const NODES = ['alpha0', 'alpha1', 'alpha12', 'alpha2', 'sigma'];
const RUNS = ['seeds-a', 'seeds-b', 'seeds-c', 'seeds-longburn', 'bad-syntax', 'bad-undefined', 'timeout-live'];
const STATUSES = ['succeeded', 'failed', 'timed_out'];

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

export function validateSampleRun(d) {
  const bad = (field) => ({ ok: false, field });
  if (!isObj(d)) return bad('(root)');
  if (d.schema_version !== 1) return bad('schema_version');
  if (!Array.isArray(d.generated_from) || d.generated_from.length === 0) return bad('generated_from');
  for (const [i, g] of d.generated_from.entries()) if (!isStr(g.path) || !HEX64.test(g.sha256) || !isNum(g.bytes) || g.bytes <= 0) return bad(`generated_from[${i}]`);
  if (!isObj(d.engine) || d.engine.name !== 'OpenBUGS' || !isStr(d.engine.version) || !isStr(d.engine.image_id) || d.engine.image_pushed !== false) return bad('engine');
  if (!isStr(d.model_summary)) return bad('model_summary');
  if (!isObj(d.published_baseline) || !isObj(d.published_baseline.nodes)) return bad('published_baseline');
  for (const n of NODES) { const p = d.published_baseline.nodes[n]; if (!isObj(p) || !isNum(p.mean) || !isNum(p.sd) || !isNum(p.mc_error)) return bad(`published_baseline.nodes.${n}`); }
  if (!isObj(d.tolerance_rule) || d.tolerance_rule.fixed_before_results !== true) return bad('tolerance_rule');
  if (!Array.isArray(d.inputs) || d.inputs.length !== 4) return bad('inputs');
  for (const [i, f] of d.inputs.entries()) if (!isStr(f.name) || !isStr(f.upstream_name) || !isNum(f.bytes) || !HEX64.test(f.sha256) || !isStr(f.rights_status)) return bad(`inputs[${i}]`);
  if (!Array.isArray(d.runs) || d.runs.length !== RUNS.length) return bad('runs');
  for (const [i, r] of d.runs.entries()) {
    const p = `runs[${i}]`;
    if (r.name !== RUNS[i]) return bad(`${p}.name`);
    if (!STATUSES.includes(r.status)) return bad(`${p}.status`);
    if (!isStr(r.reason) || !isStr(r.purpose)) return bad(`${p}.reason`);
    if (!(r.exit_code === null || isNum(r.exit_code))) return bad(`${p}.exit_code`);
    if (!isNum(r.runtime_s) || r.runtime_s < 0) return bad(`${p}.runtime_s`);
    for (const k of ['chains', 'burn_in', 'samples', 'thin', 'seed', 'timeout_s']) if (!isNum(r[k])) return bad(`${p}.${k}`);
    if (!Array.isArray(r.outputs) || !Array.isArray(r.inputs)) return bad(`${p}.outputs`);
    for (const f of [...r.outputs, ...r.inputs]) if (!isStr(f.name) || !isNum(f.bytes) || !HEX64.test(f.sha256)) return bad(`${p}.files`);
  }
  if (!Array.isArray(d.comparisons) || d.comparisons.length !== 5) return bad('comparisons');
  for (const [i, c] of d.comparisons.entries()) {
    const p = `comparisons[${i}]`;
    if (!isStr(c.id) || !['pre_declared', 'post_hoc'].includes(c.kind)) return bad(`${p}.kind`);
    if (!Array.isArray(c.rows) || c.rows.length !== 5) return bad(`${p}.rows`);
    for (const [j, r] of c.rows.entries()) {
      if (!NODES.includes(r.node)) return bad(`${p}.rows[${j}].node`);
      for (const k of ['ref_mean', 'mean', 'd_mean', 'mean_tol', 'ref_sd', 'sd', 'd_sd', 'sd_tol']) if (!isNum(r[k])) return bad(`${p}.rows[${j}].${k}`);
      for (const k of ['mean_ok', 'sd_ok', 'ok']) if (typeof r[k] !== 'boolean') return bad(`${p}.rows[${j}].${k}`);
    }
    if (!isObj(c.overall) || !['pass', 'fail'].includes(c.overall.result) || !isNum(c.overall.nodes_failed)) return bad(`${p}.overall`);
    if ((c.overall.nodes_failed === 0) !== (c.overall.result === 'pass')) return bad(`${p}.overall`);
  }
  if (d.comparisons[0].kind !== 'pre_declared' || d.comparisons[0].overall.result !== 'fail') return bad('comparisons[0]');
  if (!isObj(d.output_summary) || !isObj(d.output_summary.nodes) || !isStr(d.output_summary.label)) return bad('output_summary');
  for (const n of NODES) { const s = d.output_summary.nodes[n]; if (!isObj(s)) return bad(`output_summary.nodes.${n}`); for (const k of ['mean', 'sd', 'median', 'q2_5', 'q97_5', 'n']) if (!isNum(s[k])) return bad(`output_summary.nodes.${n}.${k}`); }
  if (!isObj(d.reproducibility) || !Array.isArray(d.reproducibility.seeds_a_vs_b) || !Array.isArray(d.reproducibility.seeds_c_vs_a)) return bad('reproducibility');
  if (!Array.isArray(d.program_output) || d.program_output.length === 0) return bad('program_output');
  for (const [i, l] of d.program_output.entries()) if (!isStr(l.run) || !isNum(l.line_no) || !isStr(l.text)) return bad(`program_output[${i}]`);
  if (!Array.isArray(d.claims) || d.claims.length === 0) return bad('claims');
  const ids = new Set();
  for (const [i, c] of d.claims.entries()) {
    if (!isStr(c.id) || !isStr(c.text) || !Array.isArray(c.evidence) || c.evidence.length === 0) return bad(`claims[${i}]`);
    ids.add(c.id);
  }
  for (const k of ['limitations', 'status_facts']) {
    if (!Array.isArray(d[k]) || d[k].length === 0) return bad(k);
    for (const [i, l] of d[k].entries()) { if (!isStr(l.id) || !Array.isArray(l.claim_ids)) return bad(`${k}[${i}]`); for (const id of l.claim_ids) if (!ids.has(id)) return bad(`${k}[${i}].claim_ids`); }
  }
  return { ok: true };
}
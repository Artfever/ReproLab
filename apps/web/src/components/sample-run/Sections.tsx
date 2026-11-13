import type { Comparison, SampleRun } from '../../lib/sample-run';
import { NODE_ORDER } from '../../lib/sample-run';
import { fmtInt, fmtNum, fmtSeconds, fmtTol } from '../../lib/format.mjs';
import { PRE_DECLARED_STATEMENT } from '../../lib/copy';
import { DataTable, Hash, ProgramOutput, StatusText } from '../data';

const COMP_COLS = [
  { key: 'node', label: 'Node' },
  { key: 'ref_mean', label: 'Published mean', numeric: true },
  { key: 'mean', label: 'ReproLab mean', numeric: true },
  { key: 'mean_tol', label: 'Mean tolerance', numeric: true },
  { key: 'ref_sd', label: 'Published sd', numeric: true },
  { key: 'sd', label: 'ReproLab sd', numeric: true },
  { key: 'sd_tol', label: 'Sd tolerance', numeric: true },
  { key: 'result', label: 'Result' },
];

function ComparisonTable({ c, caption }: { c: Comparison; caption: string }) {
  const post = c.kind === 'post_hoc';
  const rows = c.rows.map((r) => ({
    node: r.node, ref_mean: fmtNum(r.ref_mean), mean: fmtNum(r.mean), mean_tol: fmtTol(r.mean_tol),
    ref_sd: fmtNum(r.ref_sd), sd: fmtNum(r.sd), sd_tol: fmtTol(r.sd_tol),
    result: post
      ? <StatusText status={r.ok ? 'pass' : 'fail'}>{r.ok ? 'pass (post hoc)' : 'fail (post hoc)'}</StatusText>
      : <StatusText status={r.ok ? 'pass' : 'fail'}>{r.ok ? 'pass' : 'fail'}</StatusText>,
  }));
  return <DataTable id={`cmp-${c.id}`} caption={caption} columns={COMP_COLS} rows={rows} kind={c.kind} />;
}

export function SampleRunSections({ d }: { d: SampleRun }) {
  const pre = d.comparisons.filter((c) => c.kind === 'pre_declared');
  const post = d.comparisons.filter((c) => c.kind === 'post_hoc');
  const byName = (n: string) => d.runs.find((r) => r.name === n)!;
  const log = (run: string) => d.program_output.filter((p) => p.run === run);
  const failedRuns = d.runs.filter((r) => r.status !== 'succeeded');

  return (
    <>
      <section id="about" aria-labelledby="about-h">
        <h2 id="about-h">What this page is</h2>
        <p>This page is a recording. It is read-only: nothing on this site runs the engine, and there is no form to submit.</p>
        <p data-claim="engine-version">The engine was {d.engine.name} {d.engine.version}, run inside a container image with ID <Hash value={d.engine.image_id} />. The image was kept on one developer machine and never pushed to a registry.</p>
        <p>The model: {d.model_summary} The Seeds data are credited by the example to Crowder (1978) and to Breslow and Clayton (1993); bibliographic details have not been verified here.</p>
        <p data-claim="baseline-by-eye">The published baseline comes from the OpenBUGS Seeds example page and its results image on{' '}
          <a href="https://chjackson.github.io/openbugsdoc/Examples/Seeds.html" rel="noopener noreferrer">the OpenBUGS examples pages</a>. The numbers below were read by eye from that image, and the source page does not state the number of chains. The image itself is not reproduced here. OpenBUGS is hosted on{' '}
          <a href="https://sourceforge.net/projects/openbugs/" rel="noopener noreferrer">SourceForge</a>.</p>
      </section>

      <section id="comparison" aria-labelledby="comparison-h">
        <h2 id="comparison-h">The pre-declared comparison failed</h2>
        <div className="callout" data-claim="predeclared-failed">
          <p><strong>{PRE_DECLARED_STATEMENT}</strong> The comparison was fixed before the results were seen: two chains pooled, 1,000 burn-in updates.</p>
          <p>The rule: {d.tolerance_rule.mean} {d.tolerance_rule.sd}</p>
        </div>
        {pre.map((c, i) => (
          <ComparisonTable key={c.id} c={c} caption={i === 0
            ? 'Pre-declared comparison: seeds-a, 2 chains pooled, 1,000 burn-in'
            : 'Second failed comparison (not the pre-declared one): seeds-c, same setting, seed 2'} />
        ))}
      </section>

      <section id="post-hoc" aria-labelledby="post-hoc-h">
        <h2 id="post-hoc-h">Post hoc results (not an independent confirmation)</h2>
        <p data-claim="posthoc-label">The comparisons below were chosen after the first comparison failed. The 20,000 burn-in was picked because 1,000 had failed. A pass here is a post hoc result, not an independent confirmation. No convergence or scientific-validity claim is made.</p>
        {post.map((c) => (
          <ComparisonTable key={c.id} c={c} caption={`post hoc: ${c.run}, ${c.setting}. ${c.note}`} />
        ))}
      </section>

      <section id="inputs" aria-labelledby="inputs-h">
        <h2 id="inputs-h">Available inputs</h2>
        <p>Only names, sizes and hashes are shown. The upstream example files are not displayed or offered for download here, because their redistribution rights are unknown.</p>
        <DataTable id="inputs-table" caption="Input files used by the successful runs"
          columns={[{ key: 'name', label: 'Name in manifest' }, { key: 'up', label: 'Matches upstream file named' }, { key: 'bytes', label: 'Size in bytes', numeric: true }, { key: 'sha', label: 'SHA-256' }, { key: 'rights', label: 'Rights status' }]}
          rows={d.inputs.map((f) => ({ name: f.name, up: f.upstream_name, bytes: fmtInt(f.bytes), sha: <Hash value={f.sha256} />, rights: f.rights_status }))} />
      </section>

      <section id="settings" aria-labelledby="settings-h">
        <h2 id="settings-h">Settings used</h2>
        <DataTable id="settings-table" caption="Settings of the four Seeds runs"
          columns={[{ key: 'name', label: 'Run' }, { key: 'chains', label: 'Chains', numeric: true }, { key: 'burn', label: 'Burn-in', numeric: true }, { key: 'samples', label: 'Samples', numeric: true }, { key: 'thin', label: 'Thinning', numeric: true }, { key: 'seed', label: 'Seed', numeric: true }, { key: 'timeout', label: 'Timeout (s)', numeric: true }]}
          rows={d.runs.filter((r) => r.name.startsWith('seeds-')).map((r) => ({ name: r.name, chains: r.chains, burn: fmtInt(r.burn_in), samples: fmtInt(r.samples), thin: r.thin, seed: r.seed, timeout: r.timeout_s }))} />
      </section>

      <section id="output-summary" aria-labelledby="output-summary-h">
        <h2 id="output-summary-h">Output summary</h2>
        <DataTable id="summary-table" caption={`seeds-longburn, 2 chains pooled. ${d.output_summary.label}`}
          columns={[{ key: 'node', label: 'Node' }, { key: 'mean', label: 'Mean', numeric: true }, { key: 'sd', label: 'SD', numeric: true }, { key: 'median', label: 'Median', numeric: true }, { key: 'lo', label: '2.5%', numeric: true }, { key: 'hi', label: '97.5%', numeric: true }, { key: 'n', label: 'n', numeric: true }]}
          rows={NODE_ORDER.map((n) => { const s = d.output_summary.nodes[n]; return { node: n, mean: fmtNum(s.mean), sd: fmtNum(s.sd), median: fmtNum(s.median), lo: fmtNum(s.q2_5), hi: fmtNum(s.q97_5), n: fmtInt(s.n) }; })} />
        <p>This setting was chosen after the pre-declared comparison failed (see the post hoc section).</p>
      </section>

      <section id="runs" aria-labelledby="runs-h">
        <h2 id="runs-h">Recorded runs</h2>
        <DataTable id="runs-table" caption="All seven recorded runs"
          columns={[{ key: 'name', label: 'Run' }, { key: 'status', label: 'Status' }, { key: 'engine', label: 'Engine version' }, { key: 'exit', label: 'Exit code', numeric: true }, { key: 'rt', label: 'Runtime (s)', numeric: true }, { key: 'reason', label: 'Reason' }]}
          rows={d.runs.map((r) => ({ name: r.name, status: <StatusText status={r.status} />, engine: r.engine_version, exit: r.exit_code === null ? 'none (killed)' : r.exit_code, rt: fmtSeconds(r.runtime_s), reason: r.reason }))} />
        {d.runs.map((r) => (
          <DataTable key={r.name} id={`files-${r.name}`} caption={`Generated files, ${r.name}`}
            columns={[{ key: 'name', label: 'File' }, { key: 'bytes', label: 'Bytes', numeric: true }, { key: 'sha', label: 'SHA-256' }]}
            rows={r.outputs.map((f) => ({ name: f.name, bytes: fmtInt(f.bytes), sha: <Hash value={f.sha256} /> }))} />
        ))}
        {failedRuns.map((r) => r.status === 'timed_out' ? (
          <div key={r.name}>
            <p data-claim="timeout-status">{r.name}: timed_out after {fmtSeconds(r.runtime_s)} s against a {r.timeout_s} s limit; the log stopped after the model was initialised.</p>
            <ProgramOutput run={r.name} lines={log(r.name)} />
          </div>
        ) : (
          <p key={r.name} data-claim={r.name === 'bad-syntax' ? 'bad-syntax-exit0' : undefined}>{r.name}: the engine exit code was {String(r.exit_code)} although the model was invalid. ReproLab recorded the failure by reading the log.</p>
        ))}
      </section>

      <section id="reproducibility" aria-labelledby="repro-h">
        <h2 id="repro-h">Reproducibility facts</h2>
        <p>seeds-a and seeds-b used the same seed. Compared file by file: {d.reproducibility.seeds_a_vs_b.map((x) => `${x.file} ${x.identical ? 'identical' : 'different'}`).join('; ')}.</p>
        <p>seeds-c used seed 2. Compared with seeds-a: {d.reproducibility.seeds_c_vs_a.map((x) => `${x.file} ${x.identical ? 'identical' : 'different'}`).join('; ')}.</p>
        <p>This shows determinism for one image on one machine only.</p>
      </section>

      <section id="errors" aria-labelledby="errors-h">
        <h2 id="errors-h">How errors were captured</h2>
        <p>The two invalid test models are not shown. Each is shown by the first error line the engine wrote. Later lines in the log are follow-on messages.</p>
        <div data-claim="bad-syntax-line"><ProgramOutput run="bad-syntax" lines={log('bad-syntax')} /></div>
        <div data-claim="bad-undefined-line"><ProgramOutput run="bad-undefined" lines={log('bad-undefined')} /></div>
      </section>

      <section id="limitations" aria-labelledby="limits-h">
        <h2 id="limits-h">Limitations</h2>
        <ul>{d.limitations.map((l) => <li key={l.id} data-claim={l.claim_ids[0]}>{l.text}</li>)}</ul>
      </section>
    </>
  );
}
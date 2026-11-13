import type { Metadata } from 'next';
import { PageShell } from '../components/shell';
import { CTA_TEXT, HOME_FIRST, NOT_DONE } from '../lib/copy';
import { loadSampleRun } from '../lib/sample-run';
import { EmptyState } from '../components/shell';

export const metadata: Metadata = { title: 'Home | ReproLab' };

export default function HomePage() {
  const loaded = loadSampleRun();
  return (
    <PageShell current="/">
      <h1>Re-run an old analysis with its original engine</h1>
      <p className="lead">{HOME_FIRST}</p>
      <p>Who it is for: researchers who have an old analysis written for an older statistics engine and want to see it executed by that same engine, with the real log and the real output files, instead of a re-implementation.</p>
      <p><a className="cta" href="/sample-run">{CTA_TEXT}</a></p>
      {loaded.ok ? (
        <>
          <section aria-labelledby="did">
            <h2 id="did">What the tested prototype did</h2>
            <ul>
              <li data-claim="engine-version">OpenBUGS {loaded.data.engine.version} ran the Seeds example in a pinned container image on one developer machine.</li>
              <li>It kept the genuine log and output files, with a SHA-256 hash for each file.</li>
              <li data-claim="bad-syntax-line">Two deliberately invalid models failed visibly. The engine&apos;s own error line is kept.</li>
              <li data-claim="timeout-status">One run was stopped by a time limit and recorded as timed_out.</li>
              <li data-claim="predeclared-failed">The comparison with the published results that was fixed in advance failed on all five nodes. The <a href="/sample-run#comparison">sample-run page</a> shows this first.</li>
            </ul>
          </section>
          <section aria-labelledby="didnot">
            <h2 id="didnot">What the tested prototype did not do</h2>
            <ul>{NOT_DONE.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
          <section aria-labelledby="status">
            <h2 id="status">Status</h2>
            <dl className="facts">
              {loaded.data.status_facts.map((f) => (
                <div key={f.id} data-claim={f.claim_ids[0]}><dt>{f.label}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          </section>
        </>
      ) : (
        <EmptyState title="The recorded sample is not available">
          <p>The recorded sample data could not be read, so no results are shown on this page.</p>
        </EmptyState>
      )}
    </PageShell>
  );
}
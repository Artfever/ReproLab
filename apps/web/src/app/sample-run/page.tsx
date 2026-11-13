import type { Metadata } from 'next';
import { EmptyState, PageShell } from '../../components/shell';
import { loadSampleRun } from '../../lib/sample-run';
import { SampleRunSections } from '../../components/sample-run/Sections';

export const metadata: Metadata = { title: 'Sample run | ReproLab' };

export default function SampleRunPage() {
  const loaded = loadSampleRun();
  return (
    <PageShell current="/sample-run">
      <h1>Recorded sample: OpenBUGS Seeds</h1>
      {loaded.ok ? (
        <SampleRunSections d={loaded.data} />
      ) : (
        <EmptyState title="The recorded sample is not available">
          <p>The recorded sample data could not be read, so no numbers are shown. Nothing was run.</p>
        </EmptyState>
      )}
    </PageShell>
  );
}
import Link from 'next/link';
import { PageShell } from '../components/shell';

export default function NotFound() {
  return (
    <PageShell current={null}>
      <h1>Page not found</h1>
      <p>This page does not exist. Go to the <Link href="/">home page</Link> or the <a href="/sample-run">recorded sample run</a>.</p>
    </PageShell>
  );
}
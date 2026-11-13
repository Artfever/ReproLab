'use client';

import Link from 'next/link';

export default function ErrorPage() {
  return (
    <main id="main" tabIndex={-1}>
      <div className="wrap">
        <h1>Something went wrong</h1>
        <p>This page could not be shown. Nothing was run and no data was changed. Go back to the <Link href="/">home page</Link>.</p>
      </div>
    </main>
  );
}
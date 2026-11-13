import Link from 'next/link';
import type { ReactNode } from 'react';
import { BANNER_LINES, BANNER_TITLE } from '../lib/copy';

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/sample-run', label: 'Sample run' },
] as const;
export type NavHref = (typeof NAV)[number]['href'];

export function SkipLink() {
  return <a href="#main" className="skip-link">Skip to main content</a>;
}

export function SiteHeader({ current }: { current: NavHref | null }) {
  return (
    <header className="site">
      <div className="wrap">
        <Link className="brand" href="/">ReproLab</Link>
        <nav aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}><a href={n.href} aria-current={n.href === current ? 'page' : undefined}>{n.label}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function LimitsBanner() {
  return (
    <section className="limits" aria-labelledby="limits-title">
      <div className="wrap">
        <h2 id="limits-title">{BANNER_TITLE}</h2>
        <ul>{BANNER_LINES.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <p>ReproLab shows a recorded sample only. It makes no claim that a finished run is a valid scientific finding.</p>
        <ul>{NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}</ul>
        <p className="muted">Terms of Service and Privacy Policy are drafts and are not published yet. This site sets no cookies and uses no analytics.</p>
      </div>
    </footer>
  );
}

export function PageShell({ current, children }: { current: NavHref | null; children: ReactNode }) {
  return (
    <>
      <SiteHeader current={current} />
      <LimitsBanner />
      <main id="main" tabIndex={-1}>
        <div className="wrap">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="empty-title">
      <h2 id="empty-title">{title}</h2>
      {children}
      <p><Link href="/">Go to the home page</Link></p>
    </section>
  );
}
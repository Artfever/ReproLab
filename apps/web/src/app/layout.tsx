import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { SkipLink } from '../components/shell';
import './globals.css';

// IBM Plex Mono, self-hosted from src/fonts (SIL OFL 1.1). Used for figures, hashes and logs only;
// body text stays on system fonts (spec 05-ui-redesign, amendment to spec 01 Requirement 7.12).
const plexMono = localFont({
  src: [
    { path: '../fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'ReproLab',
  description: 'ReproLab shows one recorded OpenBUGS Seeds sample with its genuine logs and file hashes. Nothing runs on this site.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={plexMono.variable}>
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}

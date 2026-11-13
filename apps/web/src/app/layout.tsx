import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SkipLink } from '../components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReproLab',
  description: 'ReproLab shows one recorded OpenBUGS Seeds sample with its genuine logs and file hashes. Nothing runs on this site.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
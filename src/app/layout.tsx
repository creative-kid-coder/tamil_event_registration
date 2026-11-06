import type { Metadata, Viewport } from 'next';
import { EVENT } from '@/config/event';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${EVENT.name} · Check-in`, template: `%s · ${EVENT.name}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e14' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}

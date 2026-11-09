import type { Metadata, Viewport } from 'next';
import { plainEventName } from '@/components/EventName';
import { SponsorTicker } from '@/components/SponsorTicker';
import { EVENT } from '@/config/event';
import { sponsorThanks } from '@/config/sponsors';
import { loadSponsors } from '@/lib/sponsors';
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
  // The sponsor ticker along the bottom of every page (none until there are sponsor images).
  const tiers = loadSponsors().filter((t) => t.sponsors.length > 0);
  return (
    <html lang="en-GB">
      <body className="min-h-dvh font-sans antialiased">
        {children}
        {tiers.length > 0 && <SponsorTicker tiers={tiers} thanks={sponsorThanks(plainEventName(EVENT.name))} />}
      </body>
    </html>
  );
}

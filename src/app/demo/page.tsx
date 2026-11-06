import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT } from '@/config/event';
import { DemoPlayer } from './DemoPlayer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: `How it works · ${EVENT.name}`, robots: { index: false } };

/**
 * The "how it works" animation, made-up data only. Switched off unless
 * ENABLE_DEMO=1, so it never appears at the venue. `?render=1` is the mode the
 * video render script uses (npm run demo:render).
 */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ render?: string }> }) {
  if (process.env.ENABLE_DEMO !== '1') notFound();
  const { render } = await searchParams;
  return <DemoPlayer event={EVENT} render={render === '1'} />;
}

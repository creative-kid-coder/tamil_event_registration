import type { Metadata } from 'next';
import { plainEventName } from '@/components/EventName';
import { EVENT } from '@/config/event';
import { sponsorThanks } from '@/config/sponsors';
import type { ScheduledItem } from '@/lib/schedule';
import { getScheduleWithStatus } from '@/lib/scheduleStore';
import { loadSponsors } from '@/lib/sponsors';
import { spotlightOrder } from '@/lib/spotlight';
import { ScreenView } from './ScreenView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: `Screen · ${EVENT.name}` };

/**
 * For the hall's projector or TV: what's on now and next, the sponsors taking
 * turns (Platinum most often), and a QR to the live programme. Public, like
 * the programme page: no sign-in and no personal data.
 */
export default async function ScreenPage() {
  let items: ScheduledItem[] = [];
  try {
    items = (await getScheduleWithStatus()).items;
  } catch (error) {
    console.error(error);
  }
  const slides = spotlightOrder(
    loadSponsors().map(({ tier, sponsors }) => ({ tier, sponsors: sponsors.map((sponsor) => ({ ...sponsor, tier })) })),
  );

  return <ScreenView event={EVENT} initialItems={items} slides={slides} thanks={sponsorThanks(plainEventName(EVENT.name))} />;
}

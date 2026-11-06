import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { EVENT } from '@/config/event';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import type { ScheduledItem } from '@/lib/schedule';
import { getScheduleWithStatus } from '@/lib/scheduleStore';
import { ScheduleView } from './ScheduleView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: `Programme · ${EVENT.name}` };

/** Public programme page: no sign-in, no personal data. Refreshes itself every few seconds. */
export default async function SchedulePage() {
  let items: ScheduledItem[] = [];
  let loadError = false;
  try {
    items = getScheduleWithStatus().items;
  } catch (error) {
    console.error(error);
    loadError = true;
  }
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <ScheduleView
      event={EVENT}
      initialItems={items}
      initialError={loadError}
      initialUpdatedAt={new Date().toISOString()}
      canManage={session?.role === 'admin'}
    />
  );
}

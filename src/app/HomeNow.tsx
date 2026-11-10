'use client';

import { useCallback, useState } from 'react';
import { Bi } from '@/components/Bi';
import { ChevronRightIcon, ClockIcon } from '@/components/icons';
import { PulseDot } from '@/components/ScheduleList';
import { apiCall } from '@/lib/client';
import { nowAndNext, type ScheduledItem } from '@/lib/schedule';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** One line on the home page: what's on now (or next), linking to the programme. */
export function HomeNow() {
  const [items, setItems] = useState<ScheduledItem[] | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<{ items: ScheduledItem[] }>('/api/schedule', { redirectOn401: false });
    if (ok && data.items) setItems(data.items);
  }, []);
  useLiveRefresh(load, 30_000, { immediately: true });

  if (!items) return null;
  const { now, next } = nowAndNext(items);
  const item = now[0] ?? next[0];
  if (!item) return null;
  const live = now.length > 0;

  return (
    <a href="/schedule" className="card animate-rise group flex items-center gap-3.5 p-4 transition hover:bg-surface-2/60">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${live ? 'bg-success-soft' : 'bg-surface-2 text-muted'}`}>
        {live ? <PulseDot className="bg-success" /> : <ClockIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-semibold tracking-wide uppercase ${live ? 'text-success' : 'text-muted'}`}>
          {live ? (
            item.status === 'starting' ? (
              <Bi en="Starting now" ta="startingNow" />
            ) : (
              <Bi en="Happening now" ta="happeningNow" />
            )
          ) : (
            <>
              <Bi en="Up next" ta="upNext" /> · {item.start}
            </>
          )}
        </span>
        <span className="line-clamp-2 font-semibold">{item.title}</span>
        {now.length > 1 && <span className="block text-xs text-muted">and {now.length - 1} more</span>}
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
    </a>
  );
}

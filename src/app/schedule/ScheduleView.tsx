'use client';

import { useCallback, useState } from 'react';
import { Bi } from '@/components/Bi';
import { EventName } from '@/components/EventName';
import { BrandMark, CalendarIcon, LayoutIcon, MapPinIcon } from '@/components/icons';
import { PulseDot, ScheduleBoard } from '@/components/ScheduleList';
import { apiCall } from '@/lib/client';
import { timeOf } from '@/lib/registrations';
import { isActive, type ScheduledItem } from '@/lib/schedule';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** How often guests' phones pick up status changes. */
const POLL_MS = 15_000;

interface Props {
  event: { name: string; date: string; venue: string };
  initialItems: ScheduledItem[];
  initialError: boolean;
  initialUpdatedAt: string;
  canManage: boolean;
}

/**
 * The guest programme: the phone layout on every screen (a laptop shows exactly
 * what guests see). Keeps itself up to date, including when the phone is
 * unlocked or the tab reopened.
 */
export function ScheduleView({ event, initialItems, initialError, initialUpdatedAt, canManage }: Props) {
  const [items, setItems] = useState(initialItems);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [offline, setOffline] = useState(initialError);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<{ items: ScheduledItem[]; updatedAt: string }>('/api/schedule', { redirectOn401: false });
    if (ok && data.items) {
      setItems(data.items);
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
      setOffline(false);
    } else {
      setOffline(true);
    }
  }, []);
  useLiveRefresh(load, POLL_MS);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
          <a href="/" aria-label="Event home" className="shrink-0">
            <BrandMark className="h-9 w-9" />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] leading-tight font-semibold">
              <EventName name={event.name} />
            </h1>
            <p className="text-xs text-muted">
              <Bi en="Programme" ta="programme" />
            </p>
          </div>
          {/* "Live" only while something is on, so it never suggests the event has started when it hasn't
              (the update time is at the foot of the page, which leaves the event name room in the header) */}
          {offline ? (
            <span className="pill shrink-0 bg-warning-soft text-warning">Offline</span>
          ) : (
            items.some(isActive) && (
              <span className="pill shrink-0 bg-success-soft text-success" title={`Updated ${timeOf(updatedAt)}`}>
                <PulseDot className="bg-success" /> Live
              </span>
            )
          )}
          {canManage && (
            <a href="/admin/schedule" className="btn btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Manage programme" title="Manage programme">
              <LayoutIcon className="h-5 w-5" />
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pt-6">
        <p className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-sm text-muted">
          {event.date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {event.date}
            </span>
          )}
          {event.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-4 w-4 shrink-0" />
              {event.venue}
            </span>
          )}
        </p>

        {offline && (
          <p className="mb-5 rounded-2xl bg-warning-soft p-3.5 text-sm text-warning">
            Can&apos;t reach the server. Showing the programme as of {timeOf(updatedAt)}. It will update when you&apos;re back online.
          </p>
        )}

        <ScheduleBoard items={items} singleColumn />

        <p className="mt-8 text-center text-xs text-muted">Updated {timeOf(updatedAt)} · refreshes automatically</p>
      </main>
    </>
  );
}

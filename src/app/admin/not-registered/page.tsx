'use client';

import { useCallback, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { AlertIcon, ArrowLeftIcon, CheckCircleIcon, ChevronRightIcon, DownloadIcon, MicIcon, PhoneIcon, SearchIcon, XIcon } from '@/components/icons';
import type { Session } from '@/lib/auth';
import { apiCall } from '@/lib/client';
import { fullName, isMeaningful, matchesQuery, partyMix, timeOf, type Party } from '@/lib/registrations';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

const POLL_MS = 15_000;

interface ListResponse {
  session: Session | null;
  event: { name: string };
  parties: Party[];
}

type Filter = 'all' | 'performing' | 'volunteering';
type Sort = 'name' | 'size';

const FILTERS: { key: Filter; label: string; test: (p: Party) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'performing', label: 'Performing', test: (p) => isMeaningful(p.culturalProgram) },
  { key: 'volunteering', label: 'Volunteering', test: (p) => isMeaningful(p.volunteering) },
];

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
/** A dialable number: the digits, plus a leading + if there was one. */
const telHref = (mobile: string) => `tel:${mobile.trim().startsWith('+') ? '+' : ''}${mobile.replace(/\D/g, '')}`;

/**
 * Families who haven't checked in at the welcome desk yet. Each one drops off
 * the list as soon as a desk checks them in, so organisers can see who is
 * still to come, phone them, and chase performers before their slot.
 */
export default function NotRegisteredPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<ListResponse>('/api/registrations');
    if (data.session !== undefined) setSession(data.session ?? null);
    if (data.event?.name) setEventName(data.event.name);
    if (!ok || !data.parties) {
      setLoadError(data.error ?? 'Could not load registrations');
      return;
    }
    setParties(data.parties);
    setLoadError('');
    setLoaded(true);
    setUpdatedAt(new Date().toISOString());
  }, []);
  useLiveRefresh(load, POLL_MS, { immediately: true });

  const waiting = useMemo(() => parties.filter((p) => !p.checkIn), [parties]);
  const peopleWaiting = waiting.reduce((n, p) => n + p.totalPeople, 0);
  const checkedIn = parties.length - waiting.length;
  const pct = parties.length ? Math.round((checkedIn / parties.length) * 100) : 0;

  const shown = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const q = query.trim();
    return waiting
      .filter((p) => test(p) && (!q || matchesQuery(p, q)))
      .sort(
        (a, b) =>
          (sort === 'size' ? b.totalPeople - a.totalPeople : 0) ||
          a.surname.localeCompare(b.surname) ||
          a.firstName.localeCompare(b.firstName),
      );
  }, [waiting, filter, query, sort]);

  return (
    <>
      <AppHeader session={session} eventName={eventName} active="admin" />

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6">
        <a href="/admin" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-muted transition hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" />
          Dashboard
        </a>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Arrivals</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Not registered yet</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Families who haven’t checked in at the welcome desk. A family leaves this list as soon as a desk checks them in.
            </p>
          </div>
          <a href="/api/admin/export?only=waiting" className="btn btn-secondary min-h-11">
            <DownloadIcon className="h-4 w-4" />
            Download (CSV)
          </a>
        </div>

        {loadError && (
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1">
              {loadError}
              {loaded && '. Showing the last loaded list.'}
            </span>
            <button onClick={load} className="btn btn-secondary py-1.5">
              Retry
            </button>
          </p>
        )}

        {!loaded ? (
          !loadError && <p className="card mt-5 p-6 text-center text-sm text-muted">Loading registrations…</p>
        ) : (
          <>
            <section className="card mt-5 p-5" aria-label="Summary">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{waiting.length}</span>
                <span className="text-muted">
                  {waiting.length === 1 ? 'family' : 'families'} still to come ·{' '}
                  <b className="font-semibold text-ink tabular-nums">{people(peopleWaiting)}</b>
                </span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/70">
                <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted tabular-nums">
                <span>
                  {checkedIn} of {parties.length} families checked in
                </span>
                <span>{pct}%</span>
              </div>
            </section>

            {waiting.length === 0 ? (
              <div className="card mt-4 flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft text-success">
                  <CheckCircleIcon className="h-8 w-8" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{parties.length ? 'Everyone has registered' : 'No registrations yet'}</h2>
                <p className="mt-1 max-w-sm text-sm text-muted">
                  {parties.length
                    ? `All ${parties.length} families have checked in at the desk.`
                    : 'Add the form responses on the dashboard first.'}
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, email or mobile"
                      aria-label="Search the families not registered yet"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="input min-h-11 pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
                      {FILTERS.map((f) => {
                        const count = waiting.filter(f.test).length;
                        const on = filter === f.key;
                        if (f.key !== 'all' && count === 0 && !on) return null;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            aria-pressed={on}
                            className={`pill min-h-9 px-3 text-sm transition ${
                              on ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-ink'
                            }`}
                          >
                            {f.label}
                            <span className="tabular-nums opacity-75">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted">
                      Sort
                      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input min-h-9 w-auto py-1.5 text-sm">
                        <option value="name">Surname A–Z</option>
                        <option value="size">Largest party first</option>
                      </select>
                    </label>
                  </div>
                </div>

                {shown.length === 0 ? (
                  <div className="card mt-4 p-8 text-center">
                    <SearchIcon className="mx-auto h-8 w-8 text-muted" />
                    <p className="mt-3 font-medium">{query.trim() ? `No family still to come matches “${query.trim()}”` : 'Nobody here'}</p>
                    <p className="mt-1 text-sm text-muted">They may have checked in already: search for them at the desk.</p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                      }}
                      className="btn btn-secondary mt-4"
                    >
                      Show everyone still to come
                    </button>
                  </div>
                ) : (
                  <ul className="card mt-4 divide-y divide-line overflow-hidden">
                    {shown.map((party) => (
                      <FamilyRow key={party.ticketId} party={party} />
                    ))}
                  </ul>
                )}
              </>
            )}

            <p className="mt-3 text-center text-xs text-muted">
              {waiting.length > 0 && `Showing ${shown.length} of ${waiting.length} · `}
              Updated {timeOf(updatedAt)} · refreshes every 15 seconds
            </p>
          </>
        )}
      </main>
    </>
  );
}

function FamilyRow({ party }: { party: Party }) {
  const name = fullName(party);
  const mix = partyMix(party.badges);
  const performing = isMeaningful(party.culturalProgram);
  const volunteering = isMeaningful(party.volunteering);

  return (
    // Phones: the buttons sit under the details, so names get the full width. Wider screens: on the right.
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{name}</span>
          {party.warnings.length > 0 && (
            <span role="img" aria-label="Has data issues" title={party.warnings.join('\n')} className="shrink-0 text-warning">
              <AlertIcon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="text-sm leading-snug text-muted">
          <b className="font-medium text-ink">{people(party.totalPeople)}</b>
          {mix && ` · ${mix}`}
        </div>
        {(performing || volunteering) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {performing && (
              <span className="pill bg-brand-soft text-brand">
                <MicIcon className="h-3.5 w-3.5" />
                Performing
              </span>
            )}
            {volunteering && (
              <span className="pill max-w-full bg-surface-2 text-muted">
                <span className="truncate">Volunteer · {party.volunteering}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3">
        <a href={`/desk?ticket=${encodeURIComponent(party.ticketId)}`} className="btn btn-secondary min-h-10 px-3 text-brand">
          Check in
          <ChevronRightIcon className="h-4 w-4" />
        </a>
        {party.mobile && (
          <a href={telHref(party.mobile)} className="btn btn-ghost min-h-10 px-3 sm:order-first" aria-label={`Call ${name} on ${party.mobile}`}>
            <PhoneIcon className="h-4 w-4" />
            <span className="sm:hidden">Call</span>
            <span className="hidden tabular-nums sm:inline">{party.mobile}</span>
          </a>
        )}
      </div>
    </li>
  );
}

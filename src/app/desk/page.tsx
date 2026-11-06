'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { AlertIcon, CheckCircleIcon, ChevronRightIcon, ScanIcon, SearchIcon, XIcon } from '@/components/icons';
import { PartyCard } from '@/components/PartyCard';
import { QrScanner } from '@/components/QrScanner';
import { SearchBox } from '@/components/SearchBox';
import type { Session } from '@/lib/auth';
import { apiCall } from '@/lib/client';
import { ticketIdFromScan } from '@/lib/ids';
import { fullName, searchRegistrations, timeOf, type Party } from '@/lib/registrations';

/** How often desks pick up check-ins made at other desks. */
const POLL_MS = 10_000;

interface ListResponse {
  session: Session | null;
  event: { name: string };
  parties: Party[];
}
interface CheckInResponse {
  status: 'ok' | 'already';
  party: Party;
}
type Banner = { kind: 'success' | 'warning' | 'error'; text: string };

const BANNER_STYLES: Record<Banner['kind'], string> = {
  success: 'bg-success text-on-success',
  warning: 'bg-warning text-on-warning',
  error: 'bg-danger text-white',
};
const BANNER_ICONS: Record<Banner['kind'], React.ReactNode> = {
  success: <CheckCircleIcon className="h-6 w-6 shrink-0" />,
  warning: <AlertIcon className="h-6 w-6 shrink-0" />,
  error: <AlertIcon className="h-6 w-6 shrink-0" />,
};

export default function DeskPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<ListResponse>('/api/registrations');
    if (!ok || !data.parties) {
      setLoadError(data.error ?? 'Could not load registrations');
      return null;
    }
    setParties(data.parties);
    setSession(data.session ?? null);
    setEventName(data.event?.name ?? '');
    setLoadError('');
    setLoaded(true);
    return data.parties;
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const results = useMemo(() => searchRegistrations(parties, query), [parties, query]);
  const selected = selectedId ? parties.find((p) => p.ticketId === selectedId) : undefined;
  const checkedIn = parties.filter((p) => p.checkIn).length;
  const progress = parties.length ? Math.round((checkedIn / parties.length) * 100) : 0;

  function update(party: Party) {
    setParties((prev) => prev.map((p) => (p.ticketId === party.ticketId ? party : p)));
  }

  function select(id: string) {
    setBanner(null);
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nextParty() {
    setSelectedId(null);
    setQuery('');
    setBanner(null);
    searchRef.current?.focus();
  }

  async function handleScan(text: string) {
    setScanning(false);
    const id = ticketIdFromScan(text);
    let found = parties.find((p) => p.ticketId === id);
    // The CSV may have been replaced since the last refresh.
    if (!found) found = (await load())?.find((p) => p.ticketId === id);
    if (found) select(found.ticketId);
    else setBanner({ kind: 'error', text: `QR code not recognised (${id || text}). Search by name or mobile instead.` });
  }

  async function doCheckIn(party: Party) {
    setBusy(true);
    setBanner(null);
    const { ok, status, data } = await apiCall<CheckInResponse>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ ticketId: party.ticketId }),
    });
    setBusy(false);
    if (data.party) update(data.party);

    if (ok) {
      setBanner({ kind: 'success', text: `${fullName(party)} checked in · ${party.totalPeople} ${party.totalPeople === 1 ? 'person' : 'people'}` });
    } else if (status === 409 && data.party?.checkIn) {
      const c = data.party.checkIn;
      setBanner({ kind: 'warning', text: `Already checked in at ${timeOf(c.at)} by ${c.by} — do not give badges again` });
    } else {
      setBanner({ kind: 'error', text: data.error ?? 'Check-in failed — try again' });
    }
  }

  async function doUndo(party: Party) {
    if (!confirm(`Undo check-in for ${fullName(party)}? Only do this if the badges were NOT handed over (or were returned).`)) return;
    setBusy(true);
    const { ok, data } = await apiCall<CheckInResponse>('/api/checkin', {
      method: 'DELETE',
      body: JSON.stringify({ ticketId: party.ticketId }),
    });
    setBusy(false);
    if (ok && data.party) {
      update(data.party);
      setBanner({ kind: 'success', text: `Check-in undone for ${fullName(party)}` });
    } else {
      setBanner({ kind: 'error', text: data.error ?? 'Undo failed — try again' });
    }
  }

  return (
    <>
      <AppHeader session={session} eventName={eventName} active="desk" />

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6">
        {/* Arrivals */}
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Arrivals</div>
            <div className="mt-0.5 text-sm text-muted">
              {loaded ? (
                <>
                  <span className="text-lg font-semibold text-ink tabular-nums">{checkedIn}</span> of{' '}
                  <span className="tabular-nums">{parties.length}</span> parties checked in
                </>
              ) : (
                'Loading registrations…'
              )}
            </div>
          </div>
          <span className="text-sm font-medium text-muted tabular-nums">{loaded ? `${progress}%` : ''}</span>
        </div>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-line/70">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>

        {loadError && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-danger-soft p-4 text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm">{loadError}. Showing the last loaded list — checking in needs a connection.</span>
            <button onClick={load} className="btn btn-secondary py-1.5">
              Retry
            </button>
          </div>
        )}

        {/* Search + scan */}
        <div className="sticky top-16 z-20 -mx-4 mb-4 bg-bg/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex gap-2.5">
            <SearchBox
              ref={searchRef}
              value={query}
              onChange={(v) => {
                setQuery(v);
                setSelectedId(null);
                setBanner(null);
              }}
            />
            <button
              onClick={() => setScanning(true)}
              disabled={!loaded}
              className="btn btn-primary h-14 rounded-2xl px-5 text-base"
              aria-label="Scan QR code"
            >
              <ScanIcon className="h-6 w-6" />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>
        </div>

        {banner && (
          <div className={`animate-rise mb-4 flex items-center gap-3 rounded-2xl p-4 shadow-card ${BANNER_STYLES[banner.kind]}`} role="status">
            {BANNER_ICONS[banner.kind]}
            <span className="flex-1 font-semibold leading-snug">{banner.text}</span>
            {banner.kind !== 'error' && selected ? (
              <button onClick={nextParty} className="btn shrink-0 bg-white/90 text-slate-900 hover:bg-white">
                Next party
              </button>
            ) : (
              <button onClick={() => setBanner(null)} className="shrink-0 rounded-lg p-1.5 opacity-80 hover:opacity-100" aria-label="Dismiss">
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {selected ? (
          <PartyCard
            party={selected}
            busy={busy}
            onCheckIn={() => doCheckIn(selected)}
            onUndo={() => doUndo(selected)}
            onClose={() => {
              setSelectedId(null);
              setBanner(null);
            }}
          />
        ) : query.trim() ? (
          results.length === 0 ? (
            <div className="card p-8 text-center">
              <SearchIcon className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 font-medium">No match for “{query}”</p>
              <p className="mt-1 text-sm text-muted">Try the surname, or the last 4 digits of their mobile.</p>
            </div>
          ) : (
            <ul className="card animate-rise divide-y divide-line overflow-hidden">
              {results.map((p) => (
                <li key={p.ticketId}>
                  <button
                    onClick={() => select(p.ticketId)}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-surface-2 active:bg-surface-2"
                  >
                    <Avatar name={fullName(p)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{fullName(p)}</div>
                      <div className="truncate text-sm text-muted">
                        {p.mobile} · {p.totalPeople} {p.totalPeople === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                    {p.warnings.length > 0 && <AlertIcon className="h-4 w-4 shrink-0 text-warning" aria-label="Has warnings" />}
                    {p.checkIn ? (
                      <span className="pill bg-success-soft text-success">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {timeOf(p.checkIn.at)}
                      </span>
                    ) : (
                      <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <ScanIcon className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Ready for the next guest</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Scan their QR code, or search by name, surname or the last 4 digits of their mobile.
            </p>
            <button onClick={() => setScanning(true)} disabled={!loaded} className="btn btn-primary mt-6 h-12 px-6 text-base">
              <ScanIcon className="h-5 w-5" />
              Scan QR code
            </button>
          </div>
        )}
      </main>

      {scanning && <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />}
    </>
  );
}

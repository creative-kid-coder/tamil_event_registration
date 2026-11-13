'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AlertIcon, CheckCircleIcon, CheckIcon, FileIcon, SearchIcon, UndoIcon, UploadIcon, UtensilsIcon, XIcon } from '@/components/icons';
import type { Session } from '@/lib/auth';
import { apiCall } from '@/lib/client';
import { boxMix, matchesDinner, type DinnerRow } from '@/lib/dinner';
import type { DinnerInfo } from '@/lib/dinnerStore';
import { timeOf } from '@/lib/registrations';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** How often this page picks up boxes handed over on other phones. */
const POLL_MS = 10_000;

interface DinnerResponse {
  session: Session | null;
  event: { name: string };
  info: DinnerInfo;
  families: DinnerRow[];
}
interface HandoverResponse {
  status: 'ok' | 'already';
  family: DinnerRow;
}

type Filter = 'todo' | 'done' | 'all';
type Sort = 'sno' | 'name' | 'boxes';
type Toast = { kind: 'ok' | 'warning' | 'error'; text: string; undoKey?: string };

const TOAST_STYLES: Record<Toast['kind'], string> = {
  ok: 'bg-success text-on-success',
  warning: 'bg-warning text-on-warning',
  error: 'bg-danger text-white',
};
const SOURCE_LABEL = { local: 'Laptop file', blob: 'Vercel Blob' } as const;

const boxes = (n: number) => `${n} ${n === 1 ? 'box' : 'boxes'}`;
const snoNumber = (sno: string) => (/^\d+$/.test(sno.trim()) ? Number(sno) : Number.MAX_SAFE_INTEGER);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Admin only: the dinner packing list. Upload the CSV, see how many dinner
 * boxes each family gets (adults + young adults + juniors; under 5s don't get
 * one), and tick each family off as their boxes are handed over, the same way
 * the desk checks families in.
 */
export default function DinnerPage() {
  const [families, setFamilies] = useState<DinnerRow[]>([]);
  const [info, setInfo] = useState<DinnerInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [sort, setSort] = useState<Sort>('sno');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // While a tick is on its way to the server, a background refresh could show the old state.
  const pending = useRef(0);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<DinnerResponse>('/api/admin/dinner');
    if (data.session !== undefined) setSession(data.session ?? null);
    if (data.event?.name) setEventName(data.event.name);
    if (pending.current) return;
    if (!ok || !data.info) {
      setLoadError(data.error ?? 'Could not load the dinner list');
      return;
    }
    setInfo(data.info);
    setFamilies(data.families ?? []);
    setLoadError('');
  }, []);
  useLiveRefresh(load, POLL_MS, { immediately: true });

  const replace = (family: DinnerRow) => setFamilies((prev) => prev.map((f) => (f.key === family.key ? family : f)));

  async function handOver(family: DinnerRow) {
    setBusyKey(family.key);
    setToast(null);
    pending.current++;
    const { ok, status, data } = await apiCall<HandoverResponse>('/api/admin/dinner/handover', {
      method: 'POST',
      body: JSON.stringify({ key: family.key }),
    });
    pending.current--;
    setBusyKey(null);
    if (data.family) replace(data.family);
    if (ok) {
      setToast({ kind: 'ok', text: `${boxes(family.boxes)} handed over to ${family.name}`, undoKey: family.key });
    } else if (status === 409 && data.family?.handover) {
      const h = data.family.handover;
      setToast({ kind: 'warning', text: `${family.name} already had their boxes at ${timeOf(h.at)} (${h.by}). Don't give them again.` });
    } else {
      setToast({ kind: 'error', text: data.error ?? 'Could not save. Try again.' });
    }
  }

  async function undo(family: DinnerRow, ask = true) {
    if (ask && !confirm(`Undo "handed over" for ${family.name}? Only do this if the boxes were NOT given (or were returned).`)) return;
    setBusyKey(family.key);
    setToast(null);
    pending.current++;
    const { ok, data } = await apiCall<HandoverResponse>('/api/admin/dinner/handover', {
      method: 'DELETE',
      body: JSON.stringify({ key: family.key }),
    });
    pending.current--;
    setBusyKey(null);
    if (ok && data.family) {
      replace(data.family);
      setToast({ kind: 'ok', text: `Undone: ${family.name} is back on the list` });
    } else {
      setToast({ kind: 'error', text: data.error ?? 'Could not undo. Try again.' });
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setToast(null);
    const { ok, data } = await apiCall<DinnerResponse>('/api/admin/dinner', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: await file.text(),
    });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
    if (!ok || !data.info) {
      setToast({ kind: 'error', text: data.error ?? 'Upload failed. Try again.' });
      return;
    }
    setInfo(data.info);
    setFamilies(data.families ?? []);
    setToast({ kind: 'ok', text: `Loaded ${data.families?.length ?? 0} families from ${file.name}.` });
  }

  const stats = useMemo(() => {
    const done = families.filter((f) => f.handover);
    const todo = families.filter((f) => !f.handover);
    const sum = (list: DinnerRow[], pick: (f: DinnerRow) => number) => list.reduce((n, f) => n + pick(f), 0);
    return {
      done,
      todo,
      boxesTotal: sum(families, (f) => f.boxes),
      boxesGiven: sum(done, (f) => f.handover!.boxes),
      left: {
        adults: sum(todo, (f) => f.adults),
        youngAdults: sum(todo, (f) => f.youngAdults),
        juniors: sum(todo, (f) => f.juniors),
      },
      under5: sum(families, (f) => f.under5),
      warnings: families.filter((f) => f.warnings.length).length,
    };
  }, [families]);

  const shown = useMemo(() => {
    const list = filter === 'todo' ? stats.todo : filter === 'done' ? stats.done : families;
    return list
      .filter((f) => matchesDinner(f, query))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'boxes') return b.boxes - a.boxes || snoNumber(a.sno) - snoNumber(b.sno);
        if (filter === 'done') return b.handover!.at.localeCompare(a.handover!.at);
        return snoNumber(a.sno) - snoNumber(b.sno);
      });
  }, [families, stats, filter, query, sort]);

  const pct = stats.boxesTotal ? Math.round((stats.boxesGiven / stats.boxesTotal) * 100) : 0;
  const loaded = info !== null;
  const hasList = families.length > 0;
  const canUpload = loaded && !info.uploadBlocked;

  const uploadButton = (
    <>
      <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button onClick={() => fileInput.current?.click()} disabled={!canUpload || uploading} className="btn btn-secondary min-h-11">
        <UploadIcon className="h-4 w-4" />
        {uploading ? 'Checking and uploading…' : hasList ? 'Replace CSV' : 'Upload dinner CSV'}
      </button>
    </>
  );

  return (
    <>
      <AppHeader session={session} eventName={eventName} active="dinner" />

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Dinner</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dinner boxes</h1>
            {info?.source && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <FileIcon className="h-4 w-4 shrink-0" />
                {SOURCE_LABEL[info.source]} · updated {when(info.updatedAt)}
              </p>
            )}
          </div>
          {hasList && uploadButton}
        </div>

        {loadError && (
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{loadError}</span>
            <button onClick={load} className="btn btn-secondary py-1.5">
              Retry
            </button>
          </p>
        )}
        {info?.uploadBlocked && (
          <p className="mt-5 flex gap-2 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {info.uploadBlocked}
          </p>
        )}
        {info && info.missing.length > 0 && (
          <p className="mt-5 flex gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The dinner CSV is missing these columns: <b>{info.missing.join(', ')}</b>. Upload a corrected file.
            </span>
          </p>
        )}

        {toast && (
          <div className={`animate-rise sticky top-[7.75rem] z-20 mt-4 flex items-center gap-3 rounded-2xl p-4 shadow-card sm:top-20 ${TOAST_STYLES[toast.kind]}`} role="status">
            {toast.kind === 'ok' ? <CheckCircleIcon className="h-6 w-6 shrink-0" /> : <AlertIcon className="h-6 w-6 shrink-0" />}
            <span className="flex-1 font-semibold leading-snug">{toast.text}</span>
            {toast.undoKey && (
              <button
                onClick={() => {
                  const family = families.find((f) => f.key === toast.undoKey);
                  if (family) undo(family, false);
                }}
                className="btn shrink-0 bg-white/90 py-1.5 text-slate-900 hover:bg-white"
              >
                Undo
              </button>
            )}
            <button onClick={() => setToast(null)} className="shrink-0 rounded-lg p-1.5 opacity-80 hover:opacity-100" aria-label="Dismiss">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {!loaded ? (
          !loadError && <p className="card mt-5 p-6 text-center text-sm text-muted">Loading the dinner list…</p>
        ) : !hasList ? (
          <div className="card mt-5 flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <UtensilsIcon className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">No dinner list yet</h2>
            <p className="mt-1 mb-6 max-w-sm text-sm text-muted">
              Upload the packing list as a CSV with the columns S.No, Name, Adults, Young adults (11–16), Juniors (6–10), Under 5 (no dinner) and
              Total.
            </p>
            {uploadButton}
          </div>
        ) : (
          <>
            <section className="card mt-5 p-5" aria-label="Summary">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{stats.boxesGiven}</span>
                <span className="text-muted">
                  of <b className="font-semibold text-ink tabular-nums">{stats.boxesTotal}</b> boxes handed over
                </span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/70">
                <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted tabular-nums">
                <span>
                  {stats.done.length} of {families.length} families
                </span>
                <span>{pct}%</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ['Adults', stats.left.adults],
                    ['Young adults', stats.left.youngAdults],
                    ['Juniors', stats.left.juniors],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="rounded-xl bg-surface-2 px-2 py-2.5">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted">
                Boxes still to hand over, by type. Under 5s don’t get a box ({stats.under5} in the list).
                {stats.warnings > 0 && ` ${stats.warnings} ${stats.warnings === 1 ? 'family has' : 'families have'} a note (⚠).`}
              </p>
            </section>

            <div className="mt-5 space-y-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or S.No"
                  aria-label="Search the dinner list"
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
                  {(
                    [
                      ['todo', 'To hand over', stats.todo.length],
                      ['done', 'Handed over', stats.done.length],
                      ['all', 'All', families.length],
                    ] as const
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      aria-pressed={filter === key}
                      className={`pill min-h-9 px-3 text-sm transition ${filter === key ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-ink'}`}
                    >
                      {label}
                      <span className="tabular-nums opacity-75">{n}</span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">
                  Sort
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input min-h-9 w-auto py-1.5 text-sm">
                    <option value="sno">{filter === 'done' ? 'Latest first' : 'S.No'}</option>
                    <option value="name">Name A–Z</option>
                    <option value="boxes">Most boxes first</option>
                  </select>
                </label>
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="card mt-4 p-8 text-center">
                {filter === 'todo' && !query.trim() ? (
                  <>
                    <CheckCircleIcon className="mx-auto h-8 w-8 text-success" />
                    <p className="mt-3 font-medium">Every family has had their dinner boxes</p>
                  </>
                ) : (
                  <>
                    <SearchIcon className="mx-auto h-8 w-8 text-muted" />
                    <p className="mt-3 font-medium">{query.trim() ? `No family matches “${query.trim()}” here` : 'Nobody here yet'}</p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                      }}
                      className="btn btn-secondary mt-4"
                    >
                      Show all families
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="card mt-4 divide-y divide-line overflow-hidden">
                {shown.map((family) => (
                  <FamilyRow key={family.key} family={family} busy={busyKey === family.key} onHandOver={() => handOver(family)} onUndo={() => undo(family)} />
                ))}
              </ul>
            )}

            <p className="mt-3 text-center text-xs text-muted">
              Showing {shown.length} of {families.length} · refreshes every 10 seconds · the sheet’s own ✓ column is ignored, tick here instead
            </p>
          </>
        )}
      </main>
    </>
  );
}

function FamilyRow({ family, busy, onHandOver, onUndo }: { family: DinnerRow; busy: boolean; onHandOver: () => void; onUndo: () => void }) {
  const { handover } = family;
  const mix = boxMix(family);
  return (
    // Phones: the button sits under the details, so long names get the full width. Wider screens: on the right.
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${handover ? 'bg-success-soft/40' : ''}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${handover ? 'bg-success text-on-success' : 'bg-brand-soft text-brand'}`}
        aria-label={boxes(family.boxes)}
      >
        <span className="text-xl leading-none font-semibold tabular-nums">{family.boxes}</span>
        <span className="text-[10px] font-medium opacity-80">{family.boxes === 1 ? 'box' : 'boxes'}</span>
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {family.sno && <span className="shrink-0 text-xs font-medium text-muted tabular-nums">#{family.sno}</span>}
          <span className="truncate font-semibold">{family.name}</span>
        </div>
        <div className="text-sm leading-snug text-muted">
          {mix || 'No boxes'}
          {family.under5 > 0 && ` · ${family.under5} under 5 (no box)`}
        </div>
        {family.warnings.length > 0 && (
          <p className="mt-1 flex gap-1 text-xs text-warning">
            <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{family.warnings.join('. ')}</span>
          </p>
        )}
        {handover && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
            <CheckIcon className="h-3.5 w-3.5" />
            Handed over {timeOf(handover.at)} · {handover.by}
            {handover.boxes !== family.boxes && ` · ${boxes(handover.boxes)} at the time`}
          </p>
        )}
      </div>
      <div className="col-start-2 flex items-center gap-1.5 sm:col-start-3">
        {handover ? (
          <button onClick={onUndo} disabled={busy} className="btn btn-ghost min-h-10 px-3">
            <UndoIcon className="h-4 w-4" />
            Undo
          </button>
        ) : (
          <button onClick={onHandOver} disabled={busy || family.boxes === 0} className="btn btn-success min-h-11 px-4">
            <CheckIcon className="h-4 w-4" />
            {busy ? 'Saving…' : 'Handed over'}
          </button>
        )}
      </div>
    </li>
  );
}

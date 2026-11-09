'use client';

import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AlertIcon, ArrowRightIcon, CheckIcon, CopyIcon, DownloadIcon, ExternalIcon, MoreIcon, XIcon } from '@/components/icons';
import { KindIcon, ScheduleBoard, type ScheduleManage } from '@/components/ScheduleList';
import type { Session } from '@/lib/auth';
import { apiCall } from '@/lib/client';
import { timeOf } from '@/lib/registrations';
import { isActive, statusTimes, timeRange, type ScheduledItem, type ScheduleStatus } from '@/lib/schedule';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

const POLL_MS = 15_000;
const TOAST_MS = 6000;

interface ScheduleResponse {
  event: { name: string };
  items: ScheduledItem[];
  error: string | null;
  session: Session | null;
}
type Change = { itemId: string } & ({ status: ScheduleStatus } | { note: string } | { action: 'next' });
type Toast = { kind: 'ok' | 'error'; text: string; undo?: { itemId: string; status: ScheduleStatus }[] };

const STATUS_OPTIONS: { status: ScheduleStatus; label: string; hint: string; dot: string }[] = [
  { status: 'upcoming', label: 'Upcoming', hint: 'Not started yet', dot: 'bg-muted/40' },
  { status: 'starting', label: 'Started', hint: 'Guests see “Starting now”: come and gather', dot: 'bg-warning' },
  { status: 'live', label: 'In progress', hint: 'Guests see “Happening now”', dot: 'bg-success' },
  { status: 'done', label: 'Completed', hint: 'Moves to Finished', dot: 'bg-muted' },
  { status: 'cancelled', label: 'Cancelled', hint: 'Struck through for guests', dot: 'bg-danger' },
];
const labelOf = (status: ScheduleStatus) => STATUS_OPTIONS.find((o) => o.status === status)!.label;

/** The same change the server makes, applied straight away so taps feel instant on slow venue Wi-Fi. */
function withStatus(items: ScheduledItem[], itemId: string, status: ScheduleStatus): ScheduledItem[] {
  const now = new Date().toISOString();
  return items.map((item) => (item.id === itemId ? { ...item, status, ...statusTimes(item, status, now) } : item));
}
const nextAfter = (items: ScheduledItem[], item: ScheduledItem) =>
  items.slice(items.findIndex((i) => i.id === item.id) + 1).find((i) => i.status === 'upcoming');

export default function AdminSchedulePage() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // While a change is on its way to the server, background refreshes would undo the instant update.
  const pending = useRef(0);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<ScheduleResponse>('/api/schedule');
    if (pending.current) return;
    if (!ok || !data.items) {
      setLoadError(data.error ?? 'Could not load the programme');
      return;
    }
    setItems(data.items);
    setFileError(data.error ?? null);
    setSession(data.session ?? null);
    setEventName(data.event?.name ?? '');
    setLoadError('');
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveRefresh(load, POLL_MS);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  async function send(body: Change, optimistic: (items: ScheduledItem[]) => ScheduledItem[]) {
    pending.current++;
    setItems(optimistic);
    const { ok, data } = await apiCall<ScheduleResponse>('/api/admin/schedule', { method: 'POST', body: JSON.stringify(body) });
    pending.current--;
    if (ok && data.items) {
      if (!pending.current) setItems(data.items);
      setFileError(data.error ?? null);
      return true;
    }
    setToast({ kind: 'error', text: data.error ?? 'Could not save. Check the connection and try again.' });
    load();
    return false;
  }

  async function setStatus(item: ScheduledItem, status: ScheduleStatus) {
    setSelectedId(null);
    if (item.status === status) return;
    const ok = await send({ itemId: item.id, status }, (list) => withStatus(list, item.id, status));
    if (ok) setToast({ kind: 'ok', text: `${item.title}: ${labelOf(status)}`, undo: [{ itemId: item.id, status: item.status }] });
  }

  async function completeAndNext(item: ScheduledItem) {
    setSelectedId(null);
    const next = nextAfter(items, item);
    const ok = await send({ itemId: item.id, action: 'next' }, (list) => {
      const done = withStatus(list, item.id, 'done');
      return next ? withStatus(done, next.id, 'starting') : done;
    });
    if (!ok) return;
    const undo = [{ itemId: item.id, status: item.status }, ...(next ? [{ itemId: next.id, status: next.status }] : [])];
    setToast({ kind: 'ok', text: next ? `${item.title} completed · ${next.title} started` : `${item.title} completed`, undo });
  }

  async function saveNote(item: ScheduledItem, note: string) {
    setSelectedId(null);
    const clean = note.replace(/\s+/g, ' ').trim();
    if (clean === (item.note ?? '')) return;
    const ok = await send({ itemId: item.id, note: clean }, (list) => list.map((i) => (i.id === item.id ? { ...i, note: clean || null } : i)));
    if (ok) setToast({ kind: 'ok', text: clean ? 'Note shown to guests' : 'Note removed' });
  }

  async function undo(changes: NonNullable<Toast['undo']>) {
    setToast(null);
    for (const { itemId, status } of changes) {
      if (!(await send({ itemId, status }, (list) => withStatus(list, itemId, status)))) return;
    }
    setToast({ kind: 'ok', text: 'Undone' });
  }

  /** The one-tap next step for the now/next cards; everything else is under "⋯". */
  const manage: ScheduleManage = {
    open: (item) => setSelectedId(item.id),
    actions: (item) => {
      const next = nextAfter(items, item);
      let primary: React.ReactNode;
      if (item.status === 'starting') {
        primary = (
          <button onClick={() => setStatus(item, 'live')} className="btn btn-success min-h-12 flex-1 text-[15px]">
            Mark in progress
          </button>
        );
      } else if (item.status === 'live') {
        primary = (
          <button onClick={() => completeAndNext(item)} className="btn btn-primary min-h-12 min-w-0 flex-1 text-[15px]">
            <CheckIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{next ? `Complete & start ${next.title}` : 'Mark completed'}</span>
          </button>
        );
      } else {
        primary = (
          <button onClick={() => setStatus(item, 'starting')} className="btn btn-primary min-h-12 flex-1 text-[15px]">
            Start now
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        );
      }
      return (
        <div className="mt-4 flex gap-2 border-t border-dashed border-line pt-4">
          {primary}
          <button
            onClick={() => setSelectedId(item.id)}
            className="btn btn-secondary min-h-12 w-12 shrink-0 p-0"
            aria-label={`More options for ${item.title}`}
          >
            <MoreIcon className="h-5 w-5" />
          </button>
        </div>
      );
    },
  };

  const selected = items.find((item) => item.id === selectedId);

  return (
    <>
      <AppHeader session={session} eventName={eventName} active="schedule" />

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Programme</h1>
          <a href="/schedule" target="_blank" rel="noreferrer" className="btn btn-secondary min-h-11">
            <ExternalIcon className="h-4 w-4" />
            Guest view
          </a>
        </div>
        <p className="mb-5 text-sm text-muted">Tap an item to change its status or add a note for guests.</p>

        {fileError && (
          <div className="mb-5 flex gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">data/schedule.json has a problem{items.length ? '. Guests still see the last good version' : ''}:</p>
              <p className="mt-1 break-words whitespace-pre-line">{fileError}</p>
            </div>
          </div>
        )}
        {loadError && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" /> {loadError}
          </p>
        )}

        {loaded ? (
          <ScheduleBoard items={items} manage={manage} aside={<ShareCard />} />
        ) : (
          !loadError && <p className="card p-6 text-center text-sm text-muted">Loading the programme…</p>
        )}
      </main>

      {toast && (
        // Sits just above the sponsor ticker (--ticker-h is 0 when there isn't one).
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ticker-h,0px)] z-30 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div
            role="status"
            className={`animate-rise pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-card ${
              toast.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg'
            }`}
          >
            {toast.kind === 'error' ? <AlertIcon className="h-5 w-5 shrink-0" /> : <CheckIcon className="h-5 w-5 shrink-0" />}
            <span className="min-w-0 flex-1 text-sm font-medium">{toast.text}</span>
            {toast.undo && (
              <button onClick={() => undo(toast.undo!)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold underline-offset-2 hover:underline">
                Undo
              </button>
            )}
            <button onClick={() => setToast(null)} className="-mr-1 flex h-11 w-9 shrink-0 items-center justify-center opacity-70" aria-label="Dismiss">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {selected && (
        <ManageSheet
          item={selected}
          next={nextAfter(items, selected)}
          onClose={() => setSelectedId(null)}
          onStatus={(status) => setStatus(selected, status)}
          onNext={() => completeAndNext(selected)}
          onNote={(note) => saveNote(selected, note)}
        />
      )}
    </>
  );
}

/** Slides up from the bottom on a phone (a centred dialog on wider screens): big status choices and the guest note. */
function ManageSheet({
  item,
  next,
  onClose,
  onStatus,
  onNext,
  onNote,
}: {
  item: ScheduledItem;
  next: ScheduledItem | undefined;
  onClose: () => void;
  onStatus: (status: ScheduleStatus) => void;
  onNext: () => void;
  onNote: (note: string) => void;
}) {
  const [note, setNote] = useState(item.note ?? '');
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Once, when the sheet opens (background refreshes must not steal focus from the note field).
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button aria-label="Close" tabIndex={-1} onClick={onClose} className="animate-fade absolute inset-0 bg-black/45" />
      <div
        ref={panel}
        tabIndex={-1}
        className="animate-sheet relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card outline-none sm:max-w-md sm:rounded-3xl sm:pt-5"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
            <KindIcon kind={item.kind} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sheet-title" className="text-lg leading-snug font-semibold">
              {item.title}
            </h2>
            <p className="text-sm text-muted">{[timeRange(item), item.place].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost -mt-1 -mr-2 h-11 w-11 shrink-0 p-0" aria-label="Close">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {isActive(item) && (
          <button onClick={onNext} className="btn btn-primary mt-5 min-h-12 w-full text-[15px]">
            <CheckIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{next ? `Complete & start ${next.title}` : 'Mark completed'}</span>
          </button>
        )}

        <div role="radiogroup" aria-label="Status" className="mt-5 space-y-2">
          {STATUS_OPTIONS.map((option) => {
            const on = item.status === option.status;
            return (
              <button
                key={option.status}
                role="radio"
                aria-checked={on}
                onClick={() => onStatus(option.status)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition active:scale-[0.99] ${
                  on ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2'
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-xs text-muted">{option.hint}</span>
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand bg-brand text-on-brand' : 'border-line'}`}>
                  {on && <CheckIcon className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {(item.startedAt || item.completedAt) && (
          <p className="mt-3 text-center text-xs text-muted">
            {[item.startedAt && `Started ${timeOf(item.startedAt)}`, item.completedAt && `Finished ${timeOf(item.completedAt)}`].filter(Boolean).join(' · ')}
          </p>
        )}

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            onNote(note);
          }}
        >
          <label htmlFor="sheet-note" className="label">
            Note for guests
          </label>
          <div className="flex gap-2">
            {/* 16px text: iPhones zoom into anything smaller when you tap it. */}
            <input
              id="sheet-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              onFocus={(e) => {
                const field = e.currentTarget;
                setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
              }}
              placeholder="e.g. Moved to Hall B"
              enterKeyHint="done"
              className="input min-h-12 text-base"
            />
            <button type="submit" disabled={note.trim() === (item.note ?? '')} className="btn btn-secondary min-h-12 shrink-0">
              Save
            </button>
          </div>
          {item.note && (
            <button type="button" onClick={() => onNote('')} className="mt-2 min-h-11 text-sm font-medium text-danger">
              Remove note
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/** QR and link to the guest page, for the projector or a printed poster. */
function ShareCard() {
  const [url, setUrl] = useState('');
  const [svg, setSvg] = useState('');
  const [png, setPng] = useState('');
  const [copied, setCopied] = useState(false);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/schedule`;
    setUrl(link);
    setLocal(['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
    QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setSvg);
    QRCode.toDataURL(link, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }).then(setPng);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Share with guests</h2>
      <p className="mt-1 text-sm text-muted">Show this QR on the projector or print it on posters. No sign-in needed.</p>

      {local && (
        <p className="mt-3 flex gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          This page is open on localhost, so the QR only works on this laptop. Open the admin page through the tunnel address to get a QR for guests&apos; phones.
        </p>
      )}

      <div className="mt-4 flex items-center gap-4">
        <div className="w-28 shrink-0 rounded-xl bg-white p-2.5 ring-1 ring-black/5 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-muted" title={url}>
            {url}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="btn btn-secondary min-h-11 px-3">
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {png && (
              <a href={png} download="programme-qr.png" className="btn btn-secondary min-h-11 px-3">
                <DownloadIcon className="h-4 w-4" />
                QR image
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { ResponsesCard } from '@/components/ResponsesCard';
import { AlertIcon, CalendarIcon, CheckCircleIcon, CheckIcon, ChevronRightIcon, ClockIcon, DownloadIcon, MailIcon, PauseIcon, SearchIcon, SendIcon, TicketIcon, UsersIcon, XIcon } from '@/components/icons';
import { StatsTiles } from '@/components/StatsTiles';
import { BADGES } from '@/config/badges';
import type { Session } from '@/lib/auth';
import { apiCall } from '@/lib/client';
import { emptyCounts, fullName, searchRegistrations, timeOf, type Party } from '@/lib/registrations';
import { nowAndNext, type ScheduledItem } from '@/lib/schedule';

interface ListResponse {
  session: Session | null;
  event: { name: string };
  parties: Party[];
  missing: string[];
}
interface EmailStatus {
  configured: boolean;
  from: string | null;
  testTo: string;
  total: number;
  /** Where the QR codes and links in the emails point; null means just the ticket ID. */
  linkBase: string | null;
}
interface BatchResult {
  sent: number;
  failed: { row: number; name: string; error: string }[];
  nextOffset: number;
  total: number;
}

/** Matches BATCH_SIZE in /api/admin/send-qr. */
const SELECTED_PER_REQUEST = 10;

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          {icon && <span className="text-muted">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** One line: what's on now and next, linking to the Programme page. */
function ProgrammeBar({ items }: { items: ScheduledItem[] }) {
  const { now, next } = nowAndNext(items);
  const titles = (list: ScheduledItem[]) => list.map((i) => i.title).join(', ');
  return (
    <a href="/admin/schedule" className="card flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-2">
      <CalendarIcon className="h-5 w-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">
        {now.length > 0 ? (
          <>
            <span className="font-semibold text-success">Now:</span> {titles(now)}
          </>
        ) : (
          <span className="text-muted">{items.length ? 'Nothing marked as on right now' : 'No programme yet'}</span>
        )}
        {next.length > 0 && (
          <>
            <span className="mx-2 text-muted">·</span>
            <span className="text-muted">Next:</span> {titles(next)} <span className="text-muted">({next[0].start})</span>
          </>
        )}
      </span>
      <span className="hidden shrink-0 font-medium text-brand sm:inline">Manage</span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </a>
  );
}

/** One line: how many families haven't checked in yet, linking to the full list. */
function NotRegisteredBar({ families, people }: { families: number; people: number }) {
  return (
    <a href="/admin/not-registered" className="card flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-2">
      <UsersIcon className="h-5 w-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">
        {families > 0 ? (
          <>
            <span className="font-semibold">Not registered yet:</span> {families} {families === 1 ? 'family' : 'families'}
            <span className="text-muted">
              {' '}
              · {people} {people === 1 ? 'person' : 'people'}
            </span>
          </>
        ) : (
          <span className="font-semibold text-success">Every family has registered</span>
        )}
      </span>
      <span className="hidden shrink-0 font-medium text-brand sm:inline">View list</span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </a>
  );
}

export default function AdminPage() {
  const [regs, setRegs] = useState<Party[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [programme, setProgramme] = useState<ScheduledItem[]>([]);
  const [email, setEmail] = useState<EmailStatus | null>(null);
  const [mailMsg, setMailMsg] = useState('');
  const [testTo, setTestTo] = useState('');
  const [startFrom, setStartFrom] = useState(0);
  const [pickQuery, setPickQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ sent: number; failed: BatchResult['failed']; position: number; total: number } | null>(null);
  const [running, setRunning] = useState<false | 'all' | 'selected'>(false);
  const sending = running !== false;
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiCall<ListResponse>('/api/registrations');
    if (data.session !== undefined) setSession(data.session ?? null);
    if (data.event?.name) setEventName(data.event.name);
    if (!ok || !data.parties) {
      setError(data.error ?? 'Could not load registrations');
      return;
    }
    setRegs(data.parties);
    setMissing(data.missing ?? []);
    setError('');
    const schedule = await apiCall<{ items: ScheduledItem[] }>('/api/schedule');
    if (schedule.ok && schedule.data.items) setProgramme(schedule.data.items);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    (async () => {
      const { ok, data } = await apiCall<EmailStatus>('/api/admin/send-qr');
      if (ok) {
        setEmail(data as EmailStatus);
        setTestTo(data.testTo ?? '');
      }
    })();
    return () => clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const checked = regs.filter((r) => r.checkIn);
    const expected = emptyCounts();
    const given = emptyCounts();
    for (const r of regs) for (const b of BADGES) expected[b.key] += r.badges[b.key];
    for (const r of checked) for (const b of BADGES) given[b.key] += r.checkIn!.badges[b.key] ?? 0;
    return {
      checked,
      expected,
      given,
      peopleIn: checked.reduce((n, r) => n + r.totalPeople, 0),
      recent: [...checked].sort((a, b) => b.checkIn!.at.localeCompare(a.checkIn!.at)).slice(0, 20),
      people: regs.reduce((n, r) => n + r.totalPeople, 0),
      issues: regs.filter((r) => r.warnings.length),
      withEmail: regs.filter((r) => r.email).length,
    };
  }, [regs]);

  const total = email?.total ?? stats.withEmail;
  const emailable = useMemo(() => regs.filter((r) => r.email), [regs]);
  const pickResults = useMemo(() => searchRegistrations(emailable, pickQuery, 8), [emailable, pickQuery]);
  const pickedParties = picked.map((id) => regs.find((r) => r.ticketId === id)).filter((r): r is Party => Boolean(r));

  function togglePick(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function sendTest() {
    setBusy(true);
    setMailMsg('');
    const { ok, data } = await apiCall<{ sentTo: string; sampleOf: string }>('/api/admin/send-qr', {
      method: 'POST',
      body: JSON.stringify({ mode: 'test', to: testTo }),
    });
    setBusy(false);
    setMailMsg(
      ok
        ? `Test email (booking of ${data.sampleOf}) sent to ${data.sentTo}. Check it, and scan the QR with a desk phone.`
        : `Failed: ${data.error}`,
    );
  }

  async function sendAll() {
    const remaining = total - startFrom;
    if (remaining <= 0) {
      setMailMsg(`Nothing to send from #${startFrom + 1}. Set "Start from" to 1 to send everything again.`);
      return;
    }
    if (!confirm(`Send QR emails to ${remaining} registrants (#${startFrom + 1} to #${total})?`)) return;

    setRunning('all');
    setMailMsg('');
    stopRef.current = false;
    let position = startFrom;
    let sent = 0;
    const failed: BatchResult['failed'] = [];

    while (!stopRef.current && position < total) {
      const { ok, data } = await apiCall<BatchResult>('/api/admin/send-qr', {
        method: 'POST',
        body: JSON.stringify({ mode: 'batch', offset: position }),
      });
      if (!ok) {
        setMailMsg(`Stopped at #${position + 1}: ${data.error}`);
        break;
      }
      sent += data.sent ?? 0;
      failed.push(...(data.failed ?? []));
      position = data.nextOffset ?? total;
      setStartFrom(position);
      setProgress({ sent, failed: [...failed], position, total });
    }

    if (position >= total) setMailMsg(`Finished: ${sent} sent, ${failed.length} failed.`);
    else if (stopRef.current) setMailMsg(`Paused at #${position + 1}. Press "Send" to continue.`);
    setRunning(false);
  }

  async function sendSelected() {
    const ids = pickedParties.map((r) => r.ticketId);
    if (!ids.length) return;
    const names = pickedParties.map(fullName);
    const list = names.length <= 5 ? names.join(', ') : `${names.slice(0, 5).join(', ')} and ${names.length - 5} more`;
    if (!confirm(`Send QR emails to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}: ${list}?`)) return;

    setRunning('selected');
    setMailMsg('');
    stopRef.current = false;
    let position = 0;
    let sent = 0;
    const failed: BatchResult['failed'] = [];
    setProgress({ sent, failed: [], position, total: ids.length });

    while (!stopRef.current && position < ids.length) {
      const chunk = ids.slice(position, position + SELECTED_PER_REQUEST);
      const { ok, data } = await apiCall<BatchResult>('/api/admin/send-qr', {
        method: 'POST',
        body: JSON.stringify({ mode: 'selected', ticketIds: chunk }),
      });
      if (!ok) {
        setMailMsg(`Stopped: ${data.error}`);
        break;
      }
      sent += data.sent ?? 0;
      failed.push(...(data.failed ?? []));
      position += chunk.length;
      setProgress({ sent, failed: [...failed], position, total: ids.length });
    }

    // Keep whoever wasn't reached selected, so "Send" carries on from there.
    setPicked(ids.slice(position));
    if (position >= ids.length) {
      setMailMsg(`Finished: ${sent} sent, ${failed.length} failed.`);
      setPickQuery('');
    } else if (stopRef.current) {
      setMailMsg(`Paused — ${ids.length - position} still selected. Press "Send" to continue.`);
    }
    setRunning(false);
  }

  const sendPct = progress ? Math.round((progress.position / Math.max(1, progress.total)) * 100) : 0;

  return (
    <>
      <AppHeader session={session} eventName={eventName} active="admin" />

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-6 pb-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Dashboard</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Event overview</h1>
          </div>
          <a href="/api/admin/export" className="btn btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            Badge list (CSV)
          </a>
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" /> {error}
          </p>
        )}
        {missing.length > 0 && (
          <p className="flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span>
              Required columns not found in data/responses.csv: <b>{missing.join(', ')}</b>.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ProgrammeBar items={programme} />
          {regs.length > 0 && <NotRegisteredBar families={regs.length - stats.checked.length} people={stats.people - stats.peopleIn} />}
        </div>

        <StatsTiles
          tiles={[
            { label: 'Parties checked in', value: stats.checked.length, of: regs.length, icon: <CheckCircleIcon className="h-4 w-4" /> },
            { label: 'People checked in', value: stats.peopleIn, of: stats.people, icon: <UsersIcon className="h-4 w-4" /> },
            { label: 'With email', value: stats.withEmail, sub: `of ${regs.length} registrations`, icon: <MailIcon className="h-4 w-4" /> },
            {
              label: 'Data issues',
              value: stats.issues.length,
              sub: stats.issues.length ? 'parties need a look' : 'all clear',
              tone: stats.issues.length ? 'warning' : 'default',
              icon: <AlertIcon className="h-4 w-4" />,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Left column */}
          <div className="space-y-5 lg:col-span-3">
            <Section title="Badges" icon={<TicketIcon className="h-4 w-4" />}>
              <ul className="space-y-4">
                {BADGES.map((b) => {
                  const expected = stats.expected[b.key];
                  const given = stats.given[b.key];
                  const pct = expected ? Math.min(100, Math.round((given / expected) * 100)) : 0;
                  return (
                    <li key={b.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full ring-2 ring-surface" style={{ background: b.color }} />
                          {b.label}
                        </span>
                        <span className="text-muted tabular-nums">
                          <b className="text-ink">{given}</b> / {expected}
                          <span className="ml-2 hidden sm:inline">· {expected - given} to come</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-line/70">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: b.color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Recent check-ins" icon={<ClockIcon className="h-4 w-4" />}>
              {stats.recent.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Nobody checked in yet.</p>
              ) : (
                <ul className="-my-2 divide-y divide-line">
                  {stats.recent.map((r) => (
                    <li key={r.ticketId} className="flex items-center gap-3 py-2.5">
                      <Avatar name={fullName(r)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{fullName(r)}</div>
                        <div className="text-xs text-muted">
                          {r.totalPeople} {r.totalPeople === 1 ? 'person' : 'people'} · {r.checkIn!.by}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-muted tabular-nums">{timeOf(r.checkIn!.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-5 lg:col-span-2">
            <ResponsesCard onUploaded={load} />

            <Section
              title="QR emails"
              icon={<MailIcon className="h-4 w-4" />}
              action={
                email?.configured ? (
                  <span className="pill max-w-[55%] bg-success-soft text-success">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                    <span className="truncate">{email.from}</span>
                  </span>
                ) : (
                  <span className="pill bg-danger-soft text-danger">Not configured</span>
                )
              }
            >
              {!email?.configured && (
                <p className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
                  Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local, then restart.
                </p>
              )}

              <label className="block">
                <span className="label">Test address</span>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="you@example.com"
                    className="input"
                  />
                  <button
                    onClick={sendTest}
                    disabled={!email?.configured || !testTo.trim() || busy || sending}
                    className="btn btn-secondary"
                  >
                    Send test
                  </button>
                </div>
              </label>

              <div className="my-5 border-t border-dashed border-line" />

              <div>
                <span className="label">Send to specific people</span>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={pickQuery}
                    onChange={(e) => setPickQuery(e.target.value)}
                    placeholder="Name, email or mobile"
                    aria-label="Find people to email"
                    autoComplete="off"
                    disabled={sending}
                    className="input pl-10"
                  />
                </div>

                {pickQuery.trim() && (
                  <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                    {pickResults.length === 0 ? (
                      <li className="px-3 py-3 text-center text-sm text-muted">No one with an email matches “{pickQuery}”</li>
                    ) : (
                      pickResults.map((r) => {
                        const on = picked.includes(r.ticketId);
                        return (
                          <li key={r.ticketId}>
                            <button
                              type="button"
                              onClick={() => togglePick(r.ticketId)}
                              disabled={sending}
                              aria-pressed={on}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                                  on ? 'border-brand bg-brand text-on-brand' : 'border-line'
                                }`}
                              >
                                {on && <CheckIcon className="h-3.5 w-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{fullName(r)}</span>
                                <span className="block truncate text-xs text-muted">{r.email}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}

                {pickedParties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pickedParties.map((r) => (
                      <span key={r.ticketId} className="pill bg-brand-soft py-1 pr-1 text-brand" title={r.email}>
                        {fullName(r)}
                        <button
                          type="button"
                          onClick={() => togglePick(r.ticketId)}
                          disabled={sending}
                          aria-label={`Remove ${fullName(r)}`}
                          className="rounded-full p-0.5 transition hover:bg-brand/15"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {running === 'selected' ? (
                    <button onClick={() => (stopRef.current = true)} className="btn btn-warning flex-1">
                      <PauseIcon className="h-4 w-4" />
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={sendSelected}
                      disabled={!email?.configured || !pickedParties.length || busy || sending}
                      className="btn btn-primary flex-1"
                    >
                      <SendIcon className="h-4 w-4" />
                      {pickedParties.length ? `Send to ${pickedParties.length} selected` : 'Tick people to send to'}
                    </button>
                  )}
                  {pickedParties.length > 0 && !sending && (
                    <button onClick={() => setPicked([])} className="btn btn-ghost">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="my-5 border-t border-dashed border-line" />

              <span className="label">Send to everyone</span>
              <div className="flex items-end gap-2">
                <label className="block w-28">
                  <span className="label">Start from #</span>
                  <input
                    type="number"
                    min={1}
                    max={total}
                    value={startFrom + 1}
                    disabled={sending}
                    onChange={(e) => setStartFrom(Math.max(0, (Number(e.target.value) || 1) - 1))}
                    className="input"
                  />
                </label>
                {running === 'all' ? (
                  <button onClick={() => (stopRef.current = true)} className="btn btn-warning flex-1">
                    <PauseIcon className="h-4 w-4" />
                    Pause
                  </button>
                ) : (
                  <button onClick={sendAll} disabled={!email?.configured || busy || sending} className="btn btn-secondary flex-1">
                    <SendIcon className="h-4 w-4" />
                    Send to all ({total})
                  </button>
                )}
              </div>

              {progress && (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-line/70">
                    <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${sendPct}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
                    <span>
                      {progress.position} / {progress.total}
                      {sending && ' · sending…'}
                    </span>
                    <span>
                      {progress.sent} sent · {progress.failed.length} failed
                    </span>
                  </div>
                  {progress.failed.length > 0 && (
                    <ul className="mt-3 space-y-1 rounded-xl bg-danger-soft p-3 text-xs text-danger">
                      {progress.failed.map((f) => (
                        <li key={`${f.row}-${f.name}`}>
                          <b>{f.name}</b>
                          {f.row > 0 && ` (row ${f.row})`}: {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {mailMsg && <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">{mailMsg}</p>}

              {email && (
                <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
                  {email.linkBase ? (
                    <>
                      QR codes and links point to <b className="break-all text-ink">{email.linkBase}</b>. Check this is your app’s address
                      before sending.
                    </>
                  ) : (
                    <>QR codes hold just the ticket ID (no link), which the desk scanner reads. Set PUBLIC_BASE_URL to add a link.</>
                  )}
                </p>
              )}
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Sent from your Gmail, about one per second (Gmail allows ~500 a day). Nothing records who was emailed, so
                sending again from #1 emails everyone again.
              </p>
            </Section>

            <Section
              title="Data issues"
              icon={<AlertIcon className="h-4 w-4" />}
              action={<span className={`pill ${stats.issues.length ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>{stats.issues.length}</span>}
            >
              {stats.issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircleIcon className="h-4 w-4" /> No issues found.
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.issues.map((r) => (
                    <li key={r.ticketId} className="rounded-xl border border-warning-line/60 bg-warning-soft/60 p-3 text-sm">
                      <div className="font-medium">
                        {fullName(r)} <span className="font-normal text-muted">· row {r.row}</span>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-warning">
                        {r.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

          </div>
        </div>
      </main>
    </>
  );
}

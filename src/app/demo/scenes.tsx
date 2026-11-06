'use client';

/** The scenes of the demo video. All people, numbers and tickets here are made up. */
import { motion, useTransform } from 'motion/react';
import { useContext } from 'react';
import { Avatar } from '@/components/Avatar';
import { BadgeGrid } from '@/components/BadgeGrid';
import { EventName } from '@/components/EventName';
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BrandMark,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  LayoutIcon,
  MailIcon,
  MoreIcon,
  ScanIcon,
  SearchIcon,
  SendIcon,
  TicketIcon,
  UsersIcon,
  XIcon,
} from '@/components/icons';
import { ScheduleBoard, type ScheduleManage } from '@/components/ScheduleList';
import { StatsTiles } from '@/components/StatsTiles';
import { BADGES, type BadgeKey } from '@/config/badges';
import type { BadgeCounts } from '@/lib/registrations';
import type { ScheduledItem } from '@/lib/schedule';
import { Appear, AssetsContext, During, EASE, Laptop, Phone, Qr, Scene, Tap, useCount, useDerived, useTime, useTyped } from './kit';
import { CHAPTERS, CUE } from './timeline';

export interface DemoEvent {
  name: string;
  date: string;
  venue: string;
}

// ---------------------------------------------------------------------------
// Made-up data
// ---------------------------------------------------------------------------

const FAMILY = {
  name: 'Priya Sharma',
  first: 'Priya',
  mobile: '07700 900123',
  ticket: 'K7Q2-M9XD',
  people: 5,
  badges: { adultVeg: 2, adultNonVeg: 1, yaVeg: 0, yaNonVeg: 0, juniorVeg: 1, juniorNonVeg: 0, kids: 1 } as BadgeCounts,
};

const CSV_ROWS = [
  ['Priya', 'Sharma', '07700 900123', '3', '1', '1'],
  ['Arjun', 'Patel', '07700 900456', '2', '2', '0'],
  ['Meena', 'Krishnan', '07700 900321', '2', '0', '1'],
  ['Rahul', 'Iyer', '07700 900654', '1', '1', '0'],
];

const EXPECTED: Record<BadgeKey, number> = { adultVeg: 64, adultNonVeg: 58, yaVeg: 12, yaNonVeg: 9, juniorVeg: 21, juniorNonVeg: 18, kids: 30 };
const GIVEN: Record<BadgeKey, number> = { adultVeg: 26, adultNonVeg: 24, yaVeg: 5, yaNonVeg: 4, juniorVeg: 9, juniorNonVeg: 8, kids: 11 };

const at = (hhmm: string) => `2026-11-14T${hhmm}:00.000Z`;

function programme(stage: 'before' | 'after', note: boolean): ScheduledItem[] {
  const after = stage === 'after';
  const base = { note: null, startedAt: null, completedAt: null } as const;
  return [
    { ...base, id: 'doors', title: 'Doors open & check-in', start: '16:30', end: '17:15', place: 'Entrance', kind: 'other', status: 'done', completedAt: at('17:16') },
    { ...base, id: 'welcome', title: 'Welcome & lamp lighting', start: '17:15', end: '17:30', place: 'Main hall', kind: 'stage', status: 'done', completedAt: at('17:31') },
    {
      ...base,
      id: 'cultural',
      title: 'Cultural programme',
      start: '17:30',
      end: '18:30',
      place: 'Main hall',
      kind: 'stage',
      description: 'Dance, music and drama performances.',
      status: after ? 'done' : 'live',
      startedAt: at('17:31'),
      completedAt: after ? at('18:32') : null,
    },
    {
      ...base,
      id: 'kids',
      title: 'Kids’ activities',
      start: '18:30',
      end: '19:15',
      place: 'Kids’ corner',
      forWho: 'Kids up to 10',
      kind: 'kids',
      description: 'Diya painting, colouring and games.',
      status: after ? 'starting' : 'upcoming',
      startedAt: after ? at('18:32') : null,
      note: note ? 'Diya painting has moved to Room 2' : null,
    },
    { ...base, id: 'dinner', title: 'Dinner', start: '19:15', end: '20:15', place: 'Dining hall', kind: 'food', description: 'Please have your food badges ready.', status: 'upcoming' },
    { ...base, id: 'prizes', title: 'Prizes & thank you', start: '20:15', end: '20:45', place: 'Main hall', kind: 'stage', status: 'upcoming' },
  ];
}

// ---------------------------------------------------------------------------
// Small pieces of app UI, drawn inside the device frames
// ---------------------------------------------------------------------------

function MiniHeader({ event, right, sub = 'Check-in' }: { event: DemoEvent; right?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line/70 bg-bg/90 px-4 pt-12 pb-2.5">
      <BrandMark className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-tight font-semibold">
          <EventName name={event.name} />
        </div>
        <div className="text-[11px] text-muted">{sub}</div>
      </div>
      {right}
    </div>
  );
}

function BadgeTile({ k, count, start }: { k: BadgeKey; count: number; start: number }) {
  const b = BADGES.find((x) => x.key === k)!;
  const n = useCount(start, start + 0.6, 0, count);
  return (
    <Appear at={start} y={18} scale={0.94} dur={0.45}>
      <div
        className="flex items-center gap-4 rounded-2xl px-4 py-2.5 shadow-sm ring-1 ring-black/5"
        style={{ background: `linear-gradient(135deg, rgb(255 255 255 / 0.16), transparent 60%), ${b.color}`, color: b.textColor }}
      >
        <span className="w-8 text-4xl font-semibold tracking-tight tabular-nums">{n}</span>
        <span className="flex-1 text-[15px] leading-snug font-medium">{b.label.replace(/(\d)-(\d)/g, '$1‑$2')}</span>
      </div>
    </Appear>
  );
}

/** The desk page before a guest is chosen. */
function DeskHome({ event, query = '', showReady = true }: { event: DemoEvent; query?: string; showReady?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <MiniHeader event={event} right={<Avatar name="Desk 1" size="sm" />} />
      <div className="px-4 pt-4">
        <div className="eyebrow">Arrivals</div>
        <div className="mt-0.5 text-sm text-muted">
          <span className="text-lg font-semibold text-ink tabular-nums">22</span> of 59 parties checked in
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line/70">
          <div className="h-full w-[37%] rounded-full bg-brand" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
            <div className="input flex h-12 items-center rounded-2xl pl-11 text-[17px] shadow-card">
              {query ? (
                <>
                  {query}
                  <span className="ml-0.5 inline-block h-5 w-[2px] animate-none bg-brand" />
                </>
              ) : (
                <span className="text-muted/70">Search name or mobile</span>
              )}
            </div>
          </div>
          <div className="btn btn-primary h-12 w-14 rounded-2xl p-0">
            <ScanIcon className="h-6 w-6" />
          </div>
        </div>
      </div>
      {showReady && (
        <div className="card mx-4 mt-4 flex flex-col items-center px-5 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ScanIcon className="h-7 w-7" />
          </span>
          <div className="mt-3 text-lg font-semibold">Ready for the next guest</div>
          <p className="mt-1 text-sm text-muted">Scan their QR code, or search by name or the last 4 digits of their mobile.</p>
          <div className="btn btn-primary mt-5 h-12 px-6 text-base">
            <ScanIcon className="h-5 w-5" />
            Scan QR code
          </div>
        </div>
      )}
    </div>
  );
}

/** Camera viewfinder reading the guest's QR code. */
function Viewfinder({ start, found, name }: { start: number; found: number; name: string }) {
  const { ticketQr } = useContext(AssetsContext);
  const t = useTime();
  const sweep = (found - start - 0.6) / 2;
  const line = useTransform(t, [start + 0.4, start + 0.4 + sweep, start + 0.4 + 2 * sweep], [0, 236, 0], { clamp: true });
  const lineOpacity = useTransform(t, [found - 0.05, found], [1, 0], { clamp: true });
  const blur = useTransform(t, [start, start + 0.8], ['blur(7px)', 'blur(0px)'], { clamp: true });
  const qrScale = useTransform(t, [start, start + 0.8], [0.8, 1], { clamp: true, ease: EASE.out });
  const flash = useTransform(t, [found, found + 0.08, found + 0.5], [0, 0.55, 0], { clamp: true });
  const ok = useDerived((v) => v >= found);
  const bracket = ok ? 'border-success' : 'border-white';
  return (
    <div className="relative flex h-full flex-col items-center bg-[#0b0d12] pt-12 text-white">
      <div className="flex w-full items-center justify-between px-5">
        <XIcon className="h-6 w-6 opacity-80" />
        <span className="text-sm font-medium opacity-80">Scan QR code</span>
        <span className="w-6" />
      </div>
      <div className="relative mt-24 h-64 w-64">
        <motion.div className="absolute inset-6 rounded-lg bg-white p-3" style={{ filter: blur, scale: qrScale }}>
          <Qr svg={ticketQr} />
        </motion.div>
        {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
          <span key={c} className={`absolute h-12 w-12 ${c} ${bracket}`} />
        ))}
        <motion.span className="absolute inset-x-3 top-3 h-0.5 rounded-full bg-brand shadow-[0_0_16px_4px] shadow-brand/60" style={{ y: line, opacity: lineOpacity }} />
        <motion.span className="absolute inset-0 rounded-2xl bg-white" style={{ opacity: flash }} />
      </div>
      <div className="mt-10 text-center">
        {ok ? (
          <Appear at={found} y={8} dur={0.3} className="flex items-center gap-2 rounded-full bg-success px-4 py-2 font-semibold text-on-success">
            <CheckCircleIcon className="h-5 w-5" /> Found: {name}
          </Appear>
        ) : (
          <span className="text-sm opacity-70">Point the camera at the guest’s QR code</span>
        )}
      </div>
    </div>
  );
}

function PartyHeader() {
  return (
    <div className="flex items-start gap-3.5">
      <Avatar name={FAMILY.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="text-2xl leading-tight font-semibold tracking-tight">{FAMILY.name}</div>
        <div className="mt-1 text-sm text-muted">{FAMILY.mobile}</div>
        <span className="pill mt-2 bg-surface-2 font-mono text-muted">
          <TicketIcon className="h-3.5 w-3.5" />
          {FAMILY.ticket}
        </span>
      </div>
    </div>
  );
}

/** The party card: badges to hand over, then the check-in. */
function PartyScreen({ event }: { event: DemoEvent }) {
  const checked = useDerived((v) => v >= CUE.checkedIn);
  const tiles = BADGES.filter((b) => FAMILY.badges[b.key] > 0);
  return (
    <div className="relative flex h-full flex-col">
      <MiniHeader event={event} right={<Avatar name="Desk 1" size="sm" />} />
      {checked && (
        <Appear at={CUE.checkedIn} y={-12} dur={0.35} className="mx-3 mt-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-success p-3.5 font-semibold text-on-success shadow-card">
            <CheckCircleIcon className="h-6 w-6 shrink-0" />
            <span className="flex-1 leading-snug">{FAMILY.name} checked in · 5 people</span>
          </div>
        </Appear>
      )}
      <div className="flex items-center gap-1.5 px-4 pt-3 text-sm font-medium text-muted">
        <ArrowLeftIcon className="h-4 w-4" /> Back
      </div>
      <div className="card mx-3 mt-2 p-4">
        <PartyHeader />
        <div className="mt-4 mb-2.5 flex items-center justify-between">
          <span className="eyebrow">Badges to hand over</span>
          <span className="pill bg-brand-soft text-brand">
            <UsersIcon className="h-3.5 w-3.5" /> {FAMILY.people} people
          </span>
        </div>
        <div className="space-y-2">
          {tiles.map((b, i) => (
            <BadgeTile key={b.key} k={b.key} count={FAMILY.badges[b.key]} start={CUE.tiles + i * 0.45} />
          ))}
        </div>
        <div className="mt-4">
          {checked ? (
            <div className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-success-soft font-semibold text-success">
              <CheckIcon className="h-5 w-5" /> Checked in at 17:42 · Desk 1
            </div>
          ) : (
            <div className="btn btn-success h-14 w-full rounded-2xl text-base">
              <CheckIcon className="h-5 w-5" /> Badges handed over — Check in
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DuplicateScreen({ event }: { event: DemoEvent }) {
  return (
    <div className="flex h-full flex-col">
      <MiniHeader event={event} right={<Avatar name="Desk 2" size="sm" />} />
      <div className="card mx-3 mt-4 p-4">
        <PartyHeader />
        <Appear at={CUE.dupFound + 0.2} y={10} scale={0.97} className="mt-4">
          <div className="rounded-2xl border-2 border-warning-line bg-warning-soft p-4 text-warning">
            <div className="flex items-center gap-2 text-lg font-bold">
              <AlertIcon className="h-6 w-6" /> Already checked in
            </div>
            <p className="mt-1.5 text-[15px] leading-snug font-medium text-ink">
              17:42 by Desk 1. <b>Do not give badges again.</b> Send the guest to an organiser.
            </p>
          </div>
        </Appear>
        <div className="mt-4 space-y-2 opacity-40">
          {BADGES.filter((b) => FAMILY.badges[b.key] > 0)
            .slice(0, 2)
            .map((b) => (
              <div key={b.key} className="flex items-center gap-4 rounded-2xl px-4 py-2.5 text-white" style={{ background: b.color }}>
                <span className="w-8 text-3xl font-semibold">{FAMILY.badges[b.key]}</span>
                <span className="text-[15px] font-medium">{b.label}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/** The guest's emailed ticket, as it looks on their phone. */
function TicketScreen({ event, compact = false }: { event: DemoEvent; compact?: boolean }) {
  const { ticketQr } = useContext(AssetsContext);
  return (
    <div className="h-full bg-bg pt-11">
      <div className="mx-3 overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="bg-gradient-to-br from-brand to-brand-strong px-5 pt-5 pb-6 text-on-brand">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase opacity-85">Admit · Check-in pass</div>
          <div className="mt-2 text-xl leading-tight font-semibold">
            <EventName name={event.name} wrap />
          </div>
          {(event.date || event.venue) && <div className="mt-0.5 text-xs opacity-85">{[event.date, event.venue].filter(Boolean).join(' · ')}</div>}
        </div>
        <div className="border-t-2 border-dashed border-line" />
        <div className="p-5">
          <p className="text-center text-[15px]">
            Hi <b>{FAMILY.first}</b>, show this at the check-in desk.
          </p>
          <div className={`mx-auto mt-4 rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/5 ${compact ? 'w-56' : 'w-48'}`}>
            <Qr svg={ticketQr} />
          </div>
          <div className="mt-2 text-center font-mono tracking-[0.25em] text-muted">{FAMILY.ticket}</div>
          {!compact && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow">Your booking</span>
                <span className="text-sm text-muted">5 people</span>
              </div>
              <BadgeGrid counts={FAMILY.badges} compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export function IntroScene({ event }: { event: DemoEvent }) {
  const parts = CHAPTERS.filter((c) => c.audience);
  return (
    <Scene from={-0.6} to={5} className="flex flex-col items-center justify-center text-center">
      <Appear at={0.15} scale={0.7} y={0}>
        <BrandMark className="h-28 w-28 rounded-3xl" />
      </Appear>
      <Appear at={0.45} y={24}>
        <h1 className="mt-10 text-8xl font-semibold tracking-tight">How check-in works</h1>
      </Appear>
      <Appear at={0.8} y={16}>
        <p className="mt-5 text-3xl text-muted">
          <EventName name={event.name} wrap />
          {event.date && ` · ${event.date}`}
        </p>
      </Appear>
      <div className="mt-16 flex gap-5">
        {parts.map((c, i) => (
          <Appear key={c.id} at={1.4 + i * 0.22} y={20}>
            <div className="card px-7 py-5 text-left">
              <div className="text-sm font-semibold tracking-wider text-brand uppercase">Part {i + 1}</div>
              <div className="mt-1 text-2xl font-semibold">{c.title}</div>
              <div className="mt-0.5 text-lg text-muted">For {c.audience.toLowerCase()}</div>
            </div>
          </Appear>
        ))}
      </div>
    </Scene>
  );
}

function FlyingEnvelope({ i }: { i: number }) {
  const t = useTime();
  const s = CUE.sendStart + 0.15 + i * 0.5;
  const x = useTransform(t, [s, s + 1.1], [0, 300], { clamp: true, ease: EASE.out });
  const y = useTransform(t, [s, s + 1.1], [0, -150 - (i % 3) * 40], { clamp: true, ease: EASE.out });
  const opacity = useTransform(t, [s, s + 0.15, s + 0.8, s + 1.1], [0, 1, 1, 0], { clamp: true });
  return (
    <motion.div className="absolute flex h-14 w-20 items-center justify-center rounded-xl bg-surface text-brand shadow-card ring-1 ring-line" style={{ x, y, opacity }}>
      <MailIcon className="h-7 w-7" />
    </motion.div>
  );
}

function SendProgress() {
  const t = useTime();
  const width = useTransform(t, [CUE.sendStart, CUE.sendEnd], ['0%', '100%'], { clamp: true });
  const sent = useCount(CUE.sendStart, CUE.sendEnd, 0, 59);
  const done = useDerived((v) => v >= CUE.sendEnd);
  return (
    <div className="mt-5">
      <div className="h-3 overflow-hidden rounded-full bg-line/70">
        <motion.div className="h-full rounded-full bg-brand" style={{ width }} />
      </div>
      <div className="mt-2.5 flex justify-between text-base text-muted tabular-nums">
        <span>
          {sent} / 59 {done ? '' : '· sending…'}
        </span>
        <span>{done ? 'Finished: 59 sent, 0 failed' : `${sent} sent`}</span>
      </div>
    </div>
  );
}

export function BeforeScene({ event }: { event: DemoEvent }) {
  const lockScreen = useDerived((v) => v < CUE.openEmail);
  return (
    <>
      {/* 1. CSV in, badge totals out */}
      <Scene from={5} to={10.4}>
        <Appear at={5.1} x={-30} y={0} className="absolute top-[180px] left-[10px] w-[560px]">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5 font-semibold">
              <span className="rounded-md bg-success px-1.5 py-0.5 text-xs text-on-success">CSV</span> responses.csv
            </div>
            <div className="grid grid-cols-[1fr_1.2fr_1.6fr_0.7fr_0.7fr_0.5fr] gap-x-3 px-5 py-2 text-xs font-semibold text-muted uppercase">
              <span>First</span>
              <span>Surname</span>
              <span>Mobile</span>
              <span>Adults</span>
              <span>Juniors</span>
              <span>Kids</span>
            </div>
            {CSV_ROWS.map((row, i) => (
              <Appear key={row[1]} at={CUE.csvRows + i * 0.32} y={10} dur={0.35}>
                <div className="grid grid-cols-[1fr_1.2fr_1.6fr_0.7fr_0.7fr_0.5fr] gap-x-3 border-t border-line px-5 py-3 text-[15px] tabular-nums">
                  {row.map((cell, j) => (
                    <span key={j} className={j < 2 ? 'font-medium' : 'text-muted'}>
                      {cell}
                    </span>
                  ))}
                </div>
              </Appear>
            ))}
            <div className="border-t border-line px-5 py-3 text-sm text-muted">+ 55 more families</div>
          </div>
        </Appear>
        <Appear at={CUE.totals - 0.4} x={-20} y={0} className="absolute top-[360px] left-[598px] text-brand">
          <ArrowRightIcon className="h-14 w-14" />
        </Appear>
        <Appear at={CUE.totals} x={30} y={0} className="absolute top-[150px] left-[690px] w-[440px]">
          <div className="card p-5">
            <div className="text-lg font-semibold">Badges to prepare</div>
            <div className="mt-3 space-y-2.5">
              {BADGES.map((b) => (
                <TotalRow key={b.key} k={b.key} />
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-3 text-[15px] text-muted">
              <b className="text-ink">59</b> families · <b className="text-ink">212</b> people
            </div>
          </div>
        </Appear>
      </Scene>

      {/* 2. Send the QR emails */}
      <Scene from={10.4} to={15.3}>
        <Laptop className="absolute top-[110px] left-[58px]">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
            <BrandMark className="h-8 w-8" />
            <span className="min-w-0 flex-1 font-semibold">
            <EventName name={event.name} />
          </span>
            <span className="pill bg-surface-2 text-muted">Admin</span>
          </div>
          <div className="p-8">
            <div className="card mx-auto max-w-[560px] p-7">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xl font-semibold">
                  <MailIcon className="h-5 w-5 text-muted" /> QR emails
                </span>
                <span className="pill bg-success-soft text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> you@gmail.com
                </span>
              </div>
              <div className="relative mt-6">
                <div className="btn btn-primary h-12 w-full text-base">
                  <SendIcon className="h-5 w-5" /> Send to all (59)
                </div>
                <Tap at={CUE.sendStart - 0.1} x="50%" y="50%" />
              </div>
              <SendProgress />
            </div>
          </div>
        </Laptop>
        <div className="absolute top-[320px] left-[760px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <FlyingEnvelope key={i} i={i} />
          ))}
        </div>
      </Scene>

      {/* 3. The guest's phone */}
      <Scene from={15.3} to={21}>
        <Phone className="absolute top-[34px] left-[373px]" label="Guest’s phone" lightStatus={lockScreen}>
          <During from={0} to={CUE.openEmail}>
            <div className="h-full bg-gradient-to-br from-[#3b2fd1] via-[#6b3fd8] to-[#c2417a] px-4 pt-24 text-white">
              <div className="text-center">
                <div className="text-sm font-medium opacity-85">Monday 9 November</div>
                <div className="mt-1 text-7xl font-semibold tracking-tight">17:42</div>
              </div>
              <Appear at={CUE.notify} y={-40} dur={0.45} className="mt-10">
                <div className="relative rounded-3xl bg-white/80 p-3.5 text-ink shadow-xl backdrop-blur">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-danger text-white">
                      <MailIcon className="h-3 w-3" />
                    </span>
                    Gmail · now
                  </div>
                  <div className="mt-1.5 text-[15px] font-semibold">
                    <EventName name={event.name} />
                  </div>
                  <div className="text-sm leading-snug text-muted">Your check-in QR code: show it at the desk</div>
                  <Tap at={CUE.openEmail - 0.25} x="55%" y="55%" />
                </div>
              </Appear>
            </div>
          </During>
          <During from={CUE.openEmail}>
            <Appear at={CUE.openEmail} y={30} dur={0.4} className="h-full">
              <TicketScreen event={event} />
            </Appear>
          </During>
        </Phone>
      </Scene>
    </>
  );
}

function TotalRow({ k }: { k: BadgeKey }) {
  const b = BADGES.find((x) => x.key === k)!;
  const n = useCount(CUE.totals + 0.2, CUE.totals + 1.8, 0, EXPECTED[k]);
  return (
    <div className="flex items-center gap-3 text-[15px]">
      <span className="h-3.5 w-3.5 rounded-full" style={{ background: b.color }} />
      <span className="flex-1">{b.label}</span>
      <span className="font-semibold tabular-nums">{n}</span>
    </div>
  );
}

function FlyingBadge({ i, color }: { i: number; color: string }) {
  const t = useTime();
  const s = CUE.handover + i * 0.32;
  // From the desk phone, over the guest's phone, into a fanned stack on its left.
  const x = useTransform(t, [s, s + 0.9], [0, -660 + i * 20], { clamp: true, ease: EASE.inOut });
  const y = useTransform(t, [s, s + 0.45, s + 0.9], [0, -190, 90 - i * 4], { clamp: true });
  const rotate = useTransform(t, [s, s + 0.9], [0, -16 + i * 8], { clamp: true });
  const opacity = useTransform(t, [s - 0.01, s, 40.6, 41.0], [0, 1, 1, 0], { clamp: true });
  return (
    <motion.div className="absolute" style={{ x, y, rotate, opacity }}>
      <div className="relative h-14 w-11 rounded-lg shadow-lg ring-2 ring-white/70" style={{ background: color }}>
        <span className="absolute top-1.5 left-1/2 h-1.5 w-4 -translate-x-1/2 rounded-full bg-white/80" />
      </div>
    </motion.div>
  );
}

export function DeskScene({ event }: { event: DemoEvent }) {
  const t = useTime();
  const guestOpacity = useTransform(t, [41.0, 41.4, 46.4, 46.8], [1, 0, 0, 1], { clamp: true });
  const present = useTransform(t, [CUE.scanStart - 0.4, CUE.scanStart + 0.2, CUE.scanned + 0.2, CUE.card], [0, 50, 50, 0], { clamp: true, ease: EASE.inOut });
  const tilt = useTransform(t, [CUE.scanStart - 0.4, CUE.scanStart + 0.2, CUE.scanned + 0.2, CUE.card], [0, -5, -5, 0], { clamp: true, ease: EASE.inOut });
  const present2 = useTransform(t, [CUE.dupScan - 0.3, CUE.dupScan + 0.2, CUE.dupFound, CUE.dupFound + 0.4], [0, 50, 50, 0], { clamp: true, ease: EASE.inOut });
  const x = useTransform([present, present2], ([a, b]: number[]) => a + b);
  const deskLabel = useDerived((v) => (v >= CUE.dupScan - 0.6 ? 'Desk 2 (a second volunteer)' : 'Desk 1'));
  const guestLabel = useDerived((v) => (v >= 46 ? 'Same QR code, forwarded' : 'Guest’s phone'));
  const badgeColors = BADGES.flatMap((b) => Array(FAMILY.badges[b.key]).fill(b.color) as string[]);

  return (
    <Scene from={21} to={53}>
      <Phone className="absolute top-[34px] left-[130px]" label={guestLabel} style={{ opacity: guestOpacity, x, rotate: tilt }}>
        <TicketScreen event={event} compact />
      </Phone>

      <Phone className="absolute top-[34px] left-[616px]" label={deskLabel}>
        <During from={0} to={CUE.scanStart}>
          <DeskHome event={event} />
          <Tap at={CUE.tapScan} x="50%" y="66%" />
        </During>
        <During from={CUE.scanStart} to={CUE.card}>
          <Viewfinder start={CUE.scanStart} found={CUE.scanned} name={FAMILY.name} />
        </During>
        <During from={CUE.card} to={CUE.searchStart}>
          <Appear at={CUE.card} y={40} dur={0.45} className="h-full">
            <PartyScreen event={event} />
          </Appear>
          <Tap at={CUE.tapCheckIn} x="50%" y="76%" />
        </During>
        <During from={CUE.searchStart} to={CUE.dupScan}>
          <SearchScreen event={event} />
        </During>
        <During from={CUE.dupScan} to={CUE.dupFound}>
          <Viewfinder start={CUE.dupScan} found={CUE.dupFound - 0.3} name={FAMILY.name} />
        </During>
        <During from={CUE.dupFound}>
          <Appear at={CUE.dupFound} y={40} dur={0.45} className="h-full">
            <DuplicateScreen event={event} />
          </Appear>
        </During>
      </Phone>

      {/* Physical badges handed over from the desk to the guest */}
      <div className="absolute top-[470px] left-[690px] z-30">
        {badgeColors.map((color, i) => (
          <FlyingBadge key={i} i={i} color={color} />
        ))}
      </div>
      <Appear at={CUE.handover + 2.2} leave={40.6} dur={0.35} className="absolute top-[650px] left-[6px] z-30">
        <span className="pill bg-success px-3 py-1.5 text-sm text-on-success shadow-card">
          <CheckIcon className="h-4 w-4" /> {FAMILY.people} badges handed over
        </span>
      </Appear>
    </Scene>
  );
}

function SearchScreen({ event }: { event: DemoEvent }) {
  const query = useTyped(CUE.searchStart + 0.3, 'patel', 0.18);
  const results = useDerived((v) => v >= CUE.results);
  return (
    <div className="relative h-full">
      <DeskHome event={event} query={query} showReady={!results} />
      {results && (
        <div className="absolute inset-x-4 top-[238px]">
          <div className="card divide-y divide-line overflow-hidden">
            {[
              ['Arjun Patel', '07700 900456 · 4 people'],
              ['Kiran Patel', '07700 900789 · 2 people'],
            ].map(([name, sub], i) => (
              <Appear key={name} at={CUE.results + i * 0.18} y={8} dur={0.3}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{name}</div>
                    <div className="text-sm text-muted">{sub}</div>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-muted" />
                </div>
              </Appear>
            ))}
          </div>
          <Tap at={CUE.results + 1.9} x="45%" y="18%" />
        </div>
      )}
    </div>
  );
}

function BadgeBar({ k }: { k: BadgeKey }) {
  const b = BADGES.find((x) => x.key === k)!;
  const t = useTime();
  const given = useCount(CUE.dashCount, CUE.dashCount + 3.4, 0, GIVEN[k]);
  const width = useTransform(t, [CUE.dashCount, CUE.dashCount + 3.4], ['0%', `${Math.round((GIVEN[k] / EXPECTED[k]) * 100)}%`], { clamp: true, ease: EASE.inOut });
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
          {b.label}
        </span>
        <span className="text-muted tabular-nums">
          <b className="text-ink">{given}</b> / {EXPECTED[k]}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
        <motion.div className="h-full rounded-full" style={{ width, background: b.color }} />
      </div>
    </div>
  );
}

const ARRIVALS: [string, string, string][] = [
  ['Divya Nair', '17:47', 'Desk 2'],
  ['Rahul Iyer', '17:46', 'Desk 1'],
  ['Meena Krishnan', '17:45', 'Desk 2'],
  ['Arjun Patel', '17:44', 'Desk 1'],
  ['Priya Sharma', '17:42', 'Desk 1'],
];

export function DashboardScene({ event }: { event: DemoEvent }) {
  const parties = useCount(CUE.dashCount, CUE.dashCount + 3.4, 0, 23);
  const people = useCount(CUE.dashCount, CUE.dashCount + 3.4, 0, 87);
  // Newest first; the first three arrive one by one, the rest were already there.
  const shown = useDerived((v) => 2 + [0.4, 1.4, 2.4].filter((d) => v >= CUE.dashRecent + d).length);
  const rows = ARRIVALS.slice(ARRIVALS.length - shown);

  return (
    <Scene from={53} to={64}>
      <Laptop className="absolute top-[90px] left-[58px]">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="min-w-0 flex-1 font-semibold">
            <EventName name={event.name} />
          </span>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium">
            <span className="px-3 py-1 text-muted">Desk</span>
            <span className="rounded-lg bg-surface px-3 py-1 shadow-sm">Admin</span>
            <span className="px-3 py-1 text-muted">Programme</span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-end justify-between">
            <div className="text-2xl font-semibold tracking-tight">Event overview</div>
            <span className="btn btn-secondary py-1.5">
              <DownloadIcon className="h-4 w-4" /> Badge list (CSV)
            </span>
          </div>
          <StatsTiles
            tiles={[
              { label: 'Parties checked in', value: parties, of: 59, icon: <CheckCircleIcon className="h-4 w-4" /> },
              { label: 'People checked in', value: people, of: 212, icon: <UsersIcon className="h-4 w-4" /> },
              { label: 'With email', value: 59, sub: 'of 59 registrations', icon: <MailIcon className="h-4 w-4" /> },
              { label: 'Data issues', value: 0, sub: 'all clear', icon: <AlertIcon className="h-4 w-4" /> },
            ]}
          />
          <div className="grid grid-cols-5 gap-4">
            <div className="card col-span-3 space-y-2 p-4">
              <div className="mb-1 font-semibold">Badges handed out</div>
              {BADGES.map((b) => (
                <BadgeBar key={b.key} k={b.key} />
              ))}
            </div>
            <div className="card col-span-2 p-4">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <ClockIcon className="h-4 w-4 text-muted" /> Recent check-ins
              </div>
              <ul className="divide-y divide-line">
                {rows.map(([name, time, desk], i) => (
                  <li key={name}>
                    {i === 0 && shown > 2 ? (
                      <Appear at={CUE.dashRecent + [0.4, 1.4, 2.4][shown - 3]} y={-10} dur={0.35} className="flex items-center gap-2.5 py-2">
                        <ArrivalRow name={name} time={time} desk={desk} fresh />
                      </Appear>
                    ) : (
                      <div className="flex items-center gap-2.5 py-2">
                        <ArrivalRow name={name} time={time} desk={desk} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Laptop>
    </Scene>
  );
}

function ArrivalRow({ name, time, desk, fresh = false }: { name: string; time: string; desk: string; fresh?: boolean }) {
  return (
    <>
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted">{desk}</div>
      </div>
      <span className={`text-sm tabular-nums ${fresh ? 'font-semibold text-success' : 'text-muted'}`}>{time}</span>
    </>
  );
}

const noop = () => {};

/** The admin's quick action under the now/next cards, as on the Programme page. */
const adminActions: ScheduleManage = {
  open: noop,
  actions: (item) => {
    const label =
      item.status === 'live' ? (
        <>
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">Complete & start Kids’ activities</span>
        </>
      ) : item.status === 'starting' ? (
        'Mark in progress'
      ) : (
        <>
          Start now <ArrowRightIcon className="h-4 w-4" />
        </>
      );
    return (
      <div className="mt-4 flex gap-2 border-t border-dashed border-line pt-4">
        <span className={`btn min-h-12 min-w-0 flex-1 text-[15px] ${item.status === 'starting' ? 'btn-success' : 'btn-primary'}`}>{label}</span>
        <span className="btn btn-secondary min-h-12 w-12 shrink-0 p-0">
          <MoreIcon className="h-5 w-5" />
        </span>
      </div>
    );
  },
};

function Toast({ from, to, text, undo = true }: { from: number; to: number; text: string; undo?: boolean }) {
  return (
    <Appear at={from} leave={to} y={20} dur={0.3} className="absolute inset-x-3 bottom-6 z-30">
      <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-card">
        <CheckIcon className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{text}</span>
        {undo && <span className="text-sm font-semibold">Undo</span>}
      </div>
    </Appear>
  );
}

function NoteSheet() {
  const t = useTime();
  const y = useTransform(t, [CUE.noteType - 0.5, CUE.noteType - 0.1, CUE.noteSaved + 0.2, CUE.noteSaved + 0.55], ['100%', '0%', '0%', '100%'], {
    clamp: true,
    ease: EASE.out,
  });
  const dim = useTransform(t, [CUE.noteType - 0.5, CUE.noteType - 0.1, CUE.noteSaved + 0.2, CUE.noteSaved + 0.55], [0, 0.45, 0.45, 0], { clamp: true });
  const typed = useTyped(CUE.noteType, 'Diya painting has moved to Room 2', 0.04);
  return (
    <>
      <motion.div className="absolute inset-0 z-30 bg-black" style={{ opacity: dim }} />
      <motion.div className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl bg-surface px-5 pt-3 pb-8 shadow-card" style={{ y }}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        <div className="text-lg font-semibold">Kids’ activities</div>
        <div className="text-sm text-muted">18:30–19:15 · Kids’ corner</div>
        <div className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-brand bg-brand-soft px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" />
          <span className="flex-1">
            <span className="block font-semibold">Started</span>
            <span className="block text-xs text-muted">Guests see “Starting now”: come and gather</span>
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="label mt-5">Note for guests</div>
        <div className="relative flex gap-2">
          <div className="input flex min-h-12 items-center text-base">{typed || <span className="text-muted/70">e.g. Moved to Hall B</span>}</div>
          <div className="btn btn-primary min-h-12">Save</div>
          <Tap at={CUE.noteSaved} x="88%" y="50%" />
        </div>
      </motion.div>
    </>
  );
}

export function ProgrammeScene({ event }: { event: DemoEvent }) {
  const { posterQr } = useContext(AssetsContext);
  const t = useTime();
  const guestState = useDerived((v) => (v >= CUE.noteShown ? 2 : v >= CUE.updated ? 1 : 0));
  const orgState = useDerived((v) => (v >= CUE.noteSaved ? 2 : v >= CUE.tapComplete + 0.2 ? 1 : 0));
  const guestItems = programme(guestState > 0 ? 'after' : 'before', guestState > 1);
  const orgItems = programme(orgState > 0 ? 'after' : 'before', orgState > 1);
  const glow = useTransform(t, [CUE.updated, CUE.updated + 0.15, CUE.updated + 1.4, CUE.noteShown, CUE.noteShown + 0.15, CUE.noteShown + 1.4], [0, 1, 0, 0, 1, 0], {
    clamp: true,
  });
  const posterX = useTransform(t, [CUE.guestOpen - 0.4, CUE.guestOpen + 0.4], [0, -60], { clamp: true, ease: EASE.inOut });
  const posterOpacity = useTransform(t, [CUE.guestOpen - 0.1, CUE.guestOpen + 0.4], [1, 0], { clamp: true });

  return (
    <Scene from={64} to={82}>
      {/* Poster with the programme QR */}
      <Appear at={CUE.poster} y={30} className="absolute top-[90px] left-[360px]">
        <motion.div className="w-[420px] rounded-3xl border border-line bg-surface p-9 text-center shadow-card" style={{ x: posterX, opacity: posterOpacity }}>
          <CalendarIcon className="mx-auto h-10 w-10 text-brand" />
          <div className="mt-3 text-3xl font-semibold tracking-tight">Tonight’s programme</div>
          <div className="mt-1 text-lg text-muted">Scan for live updates</div>
          <div className="mx-auto mt-6 w-56 rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <Qr svg={posterQr} />
          </div>
          <div className="mt-5 text-base font-medium">
            <EventName name={event.name} />
          </div>
        </motion.div>
      </Appear>

      {/* Guest's phone: the public programme */}
      <Appear at={CUE.guestOpen} y={40} className="absolute top-[34px] left-[130px]">
        <Phone label="Guest’s phone">
          <div className="h-full overflow-hidden">
            <MiniHeader
              event={event}
              sub="Programme"
              right={
                <span className="pill bg-success-soft text-success">
                  <span className="h-2 w-2 rounded-full bg-success" /> Live
                </span>
              }
            />
            <div className="px-3 pt-4">
              <ScheduleBoard items={guestItems} singleColumn />
            </div>
          </div>
          <motion.div className="pointer-events-none absolute inset-0 rounded-[46px] ring-[6px] ring-success ring-inset" style={{ opacity: glow }} />
        </Phone>
      </Appear>

      {/* Organiser's phone: the Programme page */}
      <Appear at={CUE.adminIn} x={40} y={0} className="absolute top-[34px] left-[616px]">
        <Phone label="Organiser’s phone">
          <div className="h-full overflow-hidden">
            <MiniHeader event={event} right={<span className="pill bg-surface-2 text-ink"><LayoutIcon className="h-3.5 w-3.5" /> Programme</span>} />
            <div className="px-3 pt-4">
              <ScheduleBoard items={orgItems} manage={adminActions} singleColumn />
            </div>
          </div>
          <Tap at={CUE.tapComplete} x="42%" y="46%" />
          <Toast from={CUE.tapComplete + 0.2} to={CUE.tapComplete + 3.4} text="Cultural programme completed · Kids’ activities started" />
          <During from={CUE.noteType - 0.6} to={CUE.noteSaved + 0.6}>
            <NoteSheet />
          </During>
          <Toast from={CUE.noteSaved + 0.3} to={81.4} text="Note shown to guests" undo={false} />
        </Phone>
      </Appear>
    </Scene>
  );
}

export function OutroScene({ event }: { event: DemoEvent }) {
  const steps: [string, string, React.ReactNode][] = [
    ['Scan or search', 'QR code, surname or the last 4 digits of the mobile', <ScanIcon key="s" className="h-9 w-9" />],
    ['Hand over the badges shown', 'Each coloured tile is a badge colour and how many', <TicketIcon key="t" className="h-9 w-9" />],
    ['Tap Check in', 'Every desk knows straight away. No badges twice.', <CheckCircleIcon key="c" className="h-9 w-9" />],
  ];
  return (
    <Scene from={82} to={88.6} className="flex flex-col items-center justify-center text-center">
      <Appear at={82.3}>
        <div className="text-2xl font-semibold tracking-wider text-brand uppercase">At the desk</div>
        <h2 className="mt-3 text-7xl font-semibold tracking-tight">Three steps</h2>
      </Appear>
      <div className="mt-14 flex gap-6">
        {steps.map(([title, text, icon], i) => (
          <Appear key={title} at={82.8 + i * 0.35} y={24} className="card w-[400px] p-8 text-left">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-on-brand">{icon}</span>
              <span className="text-5xl font-semibold text-line">{i + 1}</span>
            </div>
            <div className="mt-6 text-3xl font-semibold">{title}</div>
            <div className="mt-2 text-xl text-muted">{text}</div>
          </Appear>
        ))}
      </div>
      <Appear at={84.2} className="mt-14 flex items-center gap-10 text-2xl text-muted">
        <span className="flex items-center gap-3">
          <CalendarIcon className="h-7 w-7 text-brand" /> Guests follow the live programme on their phones
        </span>
        <span className="flex items-center gap-3">
          <LayoutIcon className="h-7 w-7 text-brand" /> Organisers see everything live
        </span>
      </Appear>
      <Appear at={84.8} className="mt-12 flex items-center gap-3 text-xl font-medium">
        <BrandMark className="h-9 w-9" /> <EventName name={event.name} />
      </Appear>
    </Scene>
  );
}

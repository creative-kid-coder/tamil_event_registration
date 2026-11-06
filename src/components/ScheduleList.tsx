import { timeOf } from '@/lib/registrations';
import { groupSchedule, timeRange, type ScheduledItem, type ScheduleKind } from '@/lib/schedule';
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DiceIcon,
  InfoIcon,
  MapPinIcon,
  MicIcon,
  SmileIcon,
  UsersIcon,
  UtensilsIcon,
  XIcon,
} from './icons';

const KIND_ICONS: Record<ScheduleKind, (p: { className?: string }) => React.ReactNode> = {
  stage: MicIcon,
  food: UtensilsIcon,
  game: DiceIcon,
  kids: SmileIcon,
  other: ClockIcon,
};

export function KindIcon({ kind, className = 'h-4 w-4' }: { kind: ScheduleKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className={className} />;
}

export function PulseDot({ className }: { className: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${className}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${className}`} />
    </span>
  );
}

export function StatusPill({ item }: { item: Pick<ScheduledItem, 'status' | 'startedAt' | 'completedAt'> }) {
  switch (item.status) {
    case 'starting':
      return (
        <span className="pill bg-warning-soft text-warning">
          <PulseDot className="bg-warning" /> Starting now
        </span>
      );
    case 'live':
      return (
        <span className="pill bg-success-soft text-success">
          <PulseDot className="bg-success" /> Happening now
        </span>
      );
    case 'done':
      return (
        <span className="pill bg-surface-2 text-muted">
          <CheckIcon className="h-3.5 w-3.5" />
          {item.completedAt ? `Finished ${timeOf(item.completedAt)}` : 'Completed'}
        </span>
      );
    case 'cancelled':
      return (
        <span className="pill bg-danger-soft text-danger">
          <XIcon className="h-3.5 w-3.5" /> Cancelled
        </span>
      );
    default:
      return <span className="pill bg-surface-2 text-muted">Upcoming</span>;
  }
}

export function Note({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="mt-2.5 flex gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
      <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
      {note}
    </p>
  );
}

/** Admin extras: open an item's controls, and quick actions on the now/next cards. */
export interface ScheduleManage {
  open: (item: ScheduledItem) => void;
  actions: (item: ScheduledItem) => React.ReactNode;
}

/**
 * The programme, built for phones: what's on now and next at the top, the rest
 * of the day as compact rows, finished items folded away at the bottom. Each
 * item appears once. On wide screens it splits into two columns, unless
 * `singleColumn` is set.
 * Guests tap a row to read its description; with `manage`, a tap opens the
 * admin controls instead.
 */
export function ScheduleBoard({
  items,
  manage,
  aside,
  singleColumn = false,
}: {
  items: ScheduledItem[];
  manage?: ScheduleManage;
  aside?: React.ReactNode;
  /** Keep the phone layout on every screen size (the guest page), instead of two columns on wide screens. */
  singleColumn?: boolean;
}) {
  const { now, next, later, earlier } = groupSchedule(items);
  const started = items.some((item) => item.status === 'starting' || item.status === 'live' || item.status === 'done');
  const finished = started && !now.length && !next.length && later.every((item) => item.status === 'cancelled');

  if (!items.length) {
    return (
      <div className="space-y-7">
        <EmptyState icon={<ClockIcon className="h-6 w-6" />} title="Programme coming soon" text="Check back closer to the event." />
        {aside}
      </div>
    );
  }

  // grid-cols-1 is minmax(0, 1fr): the column never grows wider than the screen to fit a long line.
  return (
    <div className={`grid grid-cols-1 gap-7 ${singleColumn ? '' : 'lg:grid-cols-2 lg:gap-8'}`}>
      <div className="min-w-0 space-y-7">
        {finished ? (
          <EmptyState icon={<CheckCircleIcon className="h-6 w-6" />} title="That's a wrap" text="Thank you for coming. See you next time!" />
        ) : (
          started && (
            <Section title="Now" count={now.length}>
              {now.length ? (
                <div className="space-y-3">
                  {now.map((item) => (
                    <NowCard key={item.id} item={item}>
                      {manage?.actions(item)}
                    </NowCard>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<ClockIcon className="h-6 w-6" />} title="Short break" text="The next item will start soon." />
              )}
            </Section>
          )
        )}

        {next.length > 0 && (
          <Section title={started ? 'Up next' : 'First up'}>
            <div className="space-y-3">
              {next.map((item) => (
                <NextCard key={item.id} item={item}>
                  {manage?.actions(item)}
                </NextCard>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="min-w-0 space-y-7">
        {later.length > 0 && (
          <Section title="Later" count={later.length}>
            <ul className="card divide-y divide-line overflow-hidden">
              {later.map((item) => (
                <Row key={item.id} item={item} onOpen={manage?.open} />
              ))}
            </ul>
          </Section>
        )}

        {earlier.length > 0 && (
          <details className="group card overflow-hidden" open={finished || undefined}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <CheckIcon className="h-4 w-4 text-muted" />
              <span className="flex-1 font-semibold">Finished</span>
              <span className="pill bg-surface-2 text-muted">{earlier.length}</span>
              <ChevronRightIcon className="h-4 w-4 text-muted transition group-open:rotate-90" />
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {earlier.map((item) => (
                <Row key={item.id} item={item} onOpen={manage?.open} />
              ))}
            </ul>
          </details>
        )}

        {aside}
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-muted">
        {title}
        {count !== undefined && count > 1 && <span className="pill bg-surface-2 px-2 py-0.5">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Details({ item, className = '' }: { item: Pick<ScheduledItem, 'place' | 'forWho'>; className?: string }) {
  const bits = [
    item.place && (
      <span key="place" className="inline-flex items-center gap-1">
        <MapPinIcon className="h-4 w-4 shrink-0" />
        {item.place}
      </span>
    ),
    item.forWho && (
      <span key="who" className="inline-flex items-center gap-1">
        <UsersIcon className="h-4 w-4 shrink-0" />
        {item.forWho}
      </span>
    ),
  ].filter(Boolean);
  if (!bits.length) return null;
  return <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted ${className}`}>{bits}</div>;
}

/** A big card for something on right now. */
function NowCard({ item, children }: { item: ScheduledItem; children?: React.ReactNode }) {
  const live = item.status === 'live';
  return (
    <article className={`card animate-rise relative overflow-hidden p-4 pl-5 sm:p-5 sm:pl-6 ${live ? 'border-success/40' : 'border-warning-line'}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${live ? 'bg-success' : 'bg-warning'}`} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <StatusPill item={item} />
        <span className="text-sm text-muted tabular-nums">{timeRange(item)}</span>
      </div>
      <h3 className="mt-3 text-xl leading-snug font-semibold tracking-tight sm:text-2xl">{item.title}</h3>
      <Details item={item} className="mt-1.5" />
      {item.description && <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{item.description}</p>}
      <Note note={item.note} />
      {item.startedAt && <p className="mt-3 text-xs text-muted">Started at {timeOf(item.startedAt)}</p>}
      {children}
    </article>
  );
}

/** A card for what's coming next, with its start time up front. */
function NextCard({ item, children }: { item: ScheduledItem; children?: React.ReactNode }) {
  return (
    <article className="card p-4">
      <div className="flex gap-4">
        <div className="flex w-16 shrink-0 flex-col items-center self-start rounded-xl bg-brand-soft py-2.5 text-brand">
          <span className="text-lg leading-none font-semibold tabular-nums">{item.start}</span>
          {item.end && <span className="mt-1 text-[11px] font-medium opacity-80 tabular-nums">to {item.end}</span>}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <h3 className="text-[17px] leading-snug font-semibold">{item.title}</h3>
          <Details item={item} className="mt-1" />
          {item.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>}
          <Note note={item.note} />
        </div>
      </div>
      {children}
    </article>
  );
}

/** A compact row. Guests tap it to read the description; the admin taps it to change it. Notes are always visible. */
function Row({ item, onOpen }: { item: ScheduledItem; onOpen?: (item: ScheduledItem) => void }) {
  const cancelled = item.status === 'cancelled';
  const done = item.status === 'done';
  const expandable = Boolean(item.description || item.forWho);
  const where = [item.place, item.end && `until ${item.end}`].filter(Boolean).join(' · ');
  const summary = (
    <>
      <span className={`w-12 shrink-0 text-[15px] font-semibold tabular-nums ${done || cancelled ? 'text-muted' : ''}`}>{item.start}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-medium ${cancelled ? 'text-muted line-through' : done ? 'text-muted' : ''}`}>
          {item.title}
        </span>
        <span className="block truncate text-xs text-muted">
          {done && item.completedAt ? `Finished ${timeOf(item.completedAt)}` : cancelled ? 'Cancelled' : where}
        </span>
        {item.note && !done && <span className="mt-1 block text-xs font-medium text-brand">{item.note}</span>}
      </span>
      {!done && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 ${cancelled ? 'text-danger' : 'text-muted'}`}>
          <KindIcon kind={item.kind} />
        </span>
      )}
    </>
  );
  const rowClass = 'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left';
  const chevron = <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />;

  if (onOpen) {
    return (
      <li>
        <button type="button" onClick={() => onOpen(item)} className={`${rowClass} transition hover:bg-surface-2/60 active:bg-surface-2`}>
          {summary}
          {chevron}
        </button>
      </li>
    );
  }

  if (!expandable) {
    return (
      <li className={rowClass}>
        {summary}
        {/* Same width as the chevron, so the icons line up. */}
        <span aria-hidden="true" className="w-4 shrink-0" />
      </li>
    );
  }

  return (
    <li>
      <details className="group/row">
        <summary className={`${rowClass} cursor-pointer list-none transition hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden`}>
          {summary}
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted transition group-open/row:rotate-90" />
        </summary>
        <div className="space-y-2 px-4 pb-4 pl-[4.75rem]">
          {item.forWho && <Details item={{ forWho: item.forWho }} />}
          {item.description && <p className="text-sm leading-relaxed text-muted">{item.description}</p>}
        </div>
      </details>
    </li>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted">{text}</div>
      </div>
    </div>
  );
}

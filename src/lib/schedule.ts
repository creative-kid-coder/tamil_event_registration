/**
 * The event programme: parsing data/schedule.json and working out what's on
 * now and next. No Node APIs here, so pages can use it too (storage is in
 * scheduleStore.ts).
 */

export const STATUSES = ['upcoming', 'starting', 'live', 'done', 'cancelled'] as const;
export type ScheduleStatus = (typeof STATUSES)[number];

export const KINDS = ['stage', 'food', 'game', 'kids', 'other'] as const;
export type ScheduleKind = (typeof KINDS)[number];

export interface ScheduleItem {
  id: string;
  title: string;
  /** "HH:MM", event-day local time. Optional: items without one (e.g. the performances) show no time. */
  start?: string;
  /** Only with a start time. */
  end?: string;
  place?: string;
  description?: string;
  forWho?: string;
  kind: ScheduleKind;
}

export interface ScheduledItem extends ScheduleItem {
  status: ScheduleStatus;
  note: string | null;
  /** ISO times recorded when the admin marked the item. */
  startedAt: string | null;
  completedAt: string | null;
}

export const isStatus = (value: unknown): value is ScheduleStatus => STATUSES.includes(value as ScheduleStatus);

/** "9:05" → "09:05"; null if it isn't a 24-hour time. */
export function normalizeTime(value: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Parses and validates schedule.json. Throws one error listing every problem. */
export function parseSchedule(text: string): ScheduleItem[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`schedule.json is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  const raw = Array.isArray(json) ? json : (json as { items?: unknown })?.items;
  if (!Array.isArray(raw)) throw new Error('schedule.json must contain an "items" list');

  const problems: string[] = [];
  const seen = new Set<string>();
  const items: ScheduleItem[] = [];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const blank = (v: unknown) => v === undefined || v === null || v === '';

  raw.forEach((entry, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const id = str(e.id);
    const title = str(e.title);
    const where = `Item ${i + 1}${title ? ` ("${title}")` : ''}`;
    const start = blank(e.start) ? undefined : normalizeTime(e.start);
    const end = blank(e.end) ? undefined : normalizeTime(e.end);

    if (!id) problems.push(`${where}: missing "id"`);
    else if (seen.has(id)) problems.push(`${where}: id "${id}" is used twice`);
    if (!title) problems.push(`${where}: missing "title"`);
    if (start === null) problems.push(`${where}: "start" must be a time like 18:30 (got "${e.start}")`);
    if (end === null) problems.push(`${where}: "end" must be a time like 19:15 (got "${e.end}")`);
    else if (end && !start) problems.push(`${where}: has an "end" time but no "start" time`);
    if (!id || !title || start === null || end === null || (end && !start) || seen.has(id)) return;

    seen.add(id);
    items.push({
      id,
      title,
      start: start ?? undefined,
      end: end ?? undefined,
      place: str(e.place),
      description: str(e.description),
      forWho: str(e.forWho),
      kind: KINDS.includes(e.kind as ScheduleKind) ? (e.kind as ScheduleKind) : 'other',
    });
  });

  if (problems.length) throw new Error(problems.join('\n'));
  // The running order is the order in the file, so items without a time (the performances) keep their place.
  return items;
}

export const isActive = (item: Pick<ScheduledItem, 'status'>) => item.status === 'starting' || item.status === 'live';

type Times = Pick<ScheduledItem, 'status' | 'startedAt' | 'completedAt'>;

/**
 * The recorded times after a status change: the first Started/In progress
 * records when the item actually began, Completed records when it finished,
 * and Upcoming clears both. Shared by the server and the admin page (which
 * shows the change straight away, before the server answers).
 */
export function statusTimes(current: Times | undefined, status: ScheduleStatus, now: string): Pick<Times, 'startedAt' | 'completedAt'> {
  let startedAt = current?.startedAt ?? null;
  if (status === 'upcoming') startedAt = null;
  else if (isActive({ status }) && !startedAt) startedAt = now;
  const completedAt = status === 'done' ? (current?.status === 'done' ? current.completedAt : now) : null;
  return { startedAt, completedAt };
}

/**
 * What's on now (started or in progress) and what's up next: the earliest
 * upcoming items after the last one that has started or finished, so an item
 * that was skipped without being marked doesn't show as "next". Cancelling a
 * later item in advance doesn't move that point.
 */
export function nowAndNext<T extends ScheduledItem>(items: T[]): { now: T[]; next: T[] } {
  const now = items.filter(isActive);
  let lastReached = -1;
  items.forEach((item, i) => {
    if (isActive(item) || item.status === 'done') lastReached = i;
  });
  const after = items.filter((item, i) => i > lastReached && item.status === 'upcoming');
  // Items that share a start time come up together; an item without a time comes up on its own.
  const first = after[0];
  const next = !first ? [] : first.start ? after.filter((item) => item.start === first.start) : [first];
  return { now, next };
}

/**
 * Splits the programme for the guest page so each item appears once: now,
 * up next, later (still to come, including items cancelled from the rest of
 * the day) and earlier (finished, or cancelled before the current point).
 */
export function groupSchedule<T extends ScheduledItem>(items: T[]): { now: T[]; next: T[]; later: T[]; earlier: T[] } {
  const { now, next } = nowAndNext(items);
  const featured = new Set<T>([...now, ...next]);
  const first = items.findIndex((item) => featured.has(item));
  const boundary = first === -1 ? items.length : first;
  const later: T[] = [];
  const earlier: T[] = [];
  items.forEach((item, i) => {
    if (featured.has(item)) return;
    if (item.status === 'done' || (item.status === 'cancelled' && i < boundary)) earlier.push(item);
    else later.push(item);
  });
  return { now, next, later, earlier };
}

/** "18:30", "18:30–19:15", or "" for an item without a time. */
export const timeRange = (item: Pick<ScheduleItem, 'start' | 'end'>) =>
  !item.start ? '' : item.end ? `${item.start}–${item.end}` : item.start;

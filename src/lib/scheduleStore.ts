/**
 * Programme storage: the running order comes from data/schedule.json (picked
 * up automatically when the file changes); each item's status lives in SQLite
 * on the laptop, or in Vercel Blob on Vercel.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { blobPath, readJson, storageMode, updateJson } from './blob';
import { getDb } from './db';
import { parseSchedule, statusTimes, type ScheduledItem, type ScheduleItem, type ScheduleStatus } from './schedule';

/** SCHEDULE_JSON can point elsewhere, e.g. a sample file for a rehearsal. */
export const SCHEDULE_PATH = process.env.SCHEDULE_JSON || path.join(process.cwd(), 'data', 'schedule.json');

const NOTE_MAX = 200;

let cached: { items: ScheduleItem[]; error: string | null; mtimeMs: number; size: number } | null = null;

/**
 * The running order. A broken edit keeps the last good version live (so
 * guests never see an empty programme) and reports the problem to the admin.
 */
export function loadSchedule(): { items: ScheduleItem[]; error: string | null } {
  let stat;
  try {
    stat = statSync(SCHEDULE_PATH);
  } catch {
    return { items: cached?.items ?? [], error: 'data/schedule.json not found — add the running order there' };
  }
  if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
    let items = cached?.items ?? [];
    let error: string | null = null;
    try {
      items = parseSchedule(readFileSync(SCHEDULE_PATH, 'utf8'));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    cached = { items, error, mtimeMs: stat.mtimeMs, size: stat.size };
  }
  return { items: cached.items, error: cached.error };
}

/** An item's live status, as stored. */
interface Status {
  status: ScheduleStatus;
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
type Statuses = Map<string, Status>;
/** Changes the statuses in place and lists the items it changed. */
type Change<R> = (statuses: Statuses) => { changed: string[]; value: R };

// Laptop: SQLite -------------------------------------------------------------

interface Row {
  item_id: string;
  status: ScheduleStatus;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
}

const disk = {
  read(): Statuses {
    const rows = getDb().prepare('SELECT * FROM schedule_status').all() as unknown as Row[];
    return new Map(rows.map((r) => [r.item_id, { status: r.status, note: r.note, startedAt: r.started_at, completedAt: r.completed_at }]));
  },
  /** Runs `change` and saves what it changed, in one transaction. */
  change<R>(by: string, change: Change<R>): R {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      const statuses = disk.read();
      const { changed, value } = change(statuses);
      const at = new Date().toISOString();
      for (const id of changed) {
        const s = statuses.get(id)!;
        db.prepare(
          `INSERT INTO schedule_status (item_id, status, note, started_at, completed_at, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(item_id) DO UPDATE SET status = excluded.status, note = excluded.note, started_at = excluded.started_at,
             completed_at = excluded.completed_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        ).run(id, s.status, s.note, s.startedAt, s.completedAt, at, by);
        db.prepare('INSERT INTO schedule_log (item_id, status, note, at, by) VALUES (?, ?, ?, ?, ?)').run(id, s.status, s.note, at, by);
      }
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },
};

// Vercel: one JSON file in Blob ----------------------------------------------

interface StatusFile {
  items: Record<string, Status & { updatedAt: string; updatedBy: string }>;
  /** Audit trail, like schedule_log (most recent 1000 changes). */
  log: { itemId: string; status: ScheduleStatus; note: string | null; at: string; by: string }[];
}

const FILE = blobPath('schedule-status.json');
const emptyFile = (): StatusFile => ({ items: {}, log: [] });
/** Guest phones refresh every 15 s; statuses may be this old. Changes always read fresh. */
const READ_MAX_AGE_MS = 5000;
const pick = ({ status, note, startedAt, completedAt }: Status): Status => ({ status, note, startedAt, completedAt });

const cloud = {
  async read(): Promise<Statuses> {
    const doc = await readJson(FILE, emptyFile, READ_MAX_AGE_MS);
    return new Map(Object.entries(doc.items).map(([id, s]) => [id, pick(s)]));
  },
  change<R>(by: string, change: Change<R>): Promise<R> {
    return updateJson(FILE, emptyFile, (doc) => {
      const statuses: Statuses = new Map(Object.entries(doc.items).map(([id, s]) => [id, pick(s)]));
      const { changed, value } = change(statuses);
      const at = new Date().toISOString();
      for (const id of changed) {
        const s = statuses.get(id)!;
        doc.items[id] = { ...s, updatedAt: at, updatedBy: by };
        doc.log.push({ itemId: id, status: s.status, note: s.note, at, by });
      }
      doc.log = doc.log.slice(-1000);
      return { value, save: changed.length > 0 };
    });
  },
};

// ---------------------------------------------------------------------------

const readStatuses = async (): Promise<Statuses> => (storageMode() === 'blob' ? cloud.read() : disk.read());
const changeStatuses = async <R>(by: string, change: Change<R>): Promise<R> =>
  storageMode() === 'blob' ? cloud.change(by, change) : disk.change(by, change);

export async function getScheduleWithStatus(): Promise<{ items: ScheduledItem[]; error: string | null }> {
  const { items, error } = loadSchedule();
  const statuses = await readStatuses();
  return {
    error,
    items: items.map((item) => {
      const s = statuses.get(item.id);
      return { ...item, status: s?.status ?? 'upcoming', note: s?.note ?? null, startedAt: s?.startedAt ?? null, completedAt: s?.completedAt ?? null };
    }),
  };
}

const withStatus = (current: Status | undefined, status: ScheduleStatus, now: string): Status => ({
  status,
  note: current?.note ?? null,
  ...statusTimes(current, status, now),
});

/**
 * Moves an item to any status. The first Started/In progress records when it
 * actually began; Completed records when it finished; Upcoming clears both.
 */
export async function setStatus(itemId: string, status: ScheduleStatus, by: string) {
  await changeStatuses(by, (statuses) => {
    statuses.set(itemId, withStatus(statuses.get(itemId), status, new Date().toISOString()));
    return { changed: [itemId], value: undefined };
  });
}

/** Sets or clears (empty text) the note guests see under the item. */
export async function setNote(itemId: string, note: string, by: string) {
  const clean = note.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) || null;
  await changeStatuses(by, (statuses) => {
    const current = statuses.get(itemId);
    statuses.set(itemId, {
      status: current?.status ?? 'upcoming',
      note: clean,
      startedAt: current?.startedAt ?? null,
      completedAt: current?.completedAt ?? null,
    });
    return { changed: [itemId], value: undefined };
  });
}

/** Marks an item Completed and the next upcoming item Started, together. Returns that item's id, if any. */
export async function completeAndStartNext(itemId: string, by: string): Promise<string | null> {
  const { items } = loadSchedule();
  return changeStatuses(by, (statuses) => {
    const now = new Date().toISOString();
    statuses.set(itemId, withStatus(statuses.get(itemId), 'done', now));
    const index = items.findIndex((item) => item.id === itemId);
    const next = items.slice(index + 1).find((item) => (statuses.get(item.id)?.status ?? 'upcoming') === 'upcoming');
    if (next) statuses.set(next.id, withStatus(statuses.get(next.id), 'starting', now));
    return { changed: next ? [itemId, next.id] : [itemId], value: next?.id ?? null };
  });
}

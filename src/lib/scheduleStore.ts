/**
 * Programme storage: the running order comes from data/schedule.json (picked
 * up automatically when the file changes); each item's status lives in SQLite.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
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

interface Row {
  item_id: string;
  status: ScheduleStatus;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
}

const getRow = (itemId: string) =>
  getDb().prepare('SELECT * FROM schedule_status WHERE item_id = ?').get(itemId) as unknown as Row | undefined;

export function getScheduleWithStatus(): { items: ScheduledItem[]; error: string | null } {
  const { items, error } = loadSchedule();
  const rows = getDb().prepare('SELECT * FROM schedule_status').all() as unknown as Row[];
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  return {
    error,
    items: items.map((item) => {
      const row = byId.get(item.id);
      return {
        ...item,
        status: row?.status ?? 'upcoming',
        note: row?.note ?? null,
        startedAt: row?.started_at ?? null,
        completedAt: row?.completed_at ?? null,
      };
    }),
  };
}

function save(itemId: string, status: ScheduleStatus, note: string | null, startedAt: string | null, completedAt: string | null, by: string) {
  const at = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO schedule_status (item_id, status, note, started_at, completed_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET status = excluded.status, note = excluded.note, started_at = excluded.started_at,
       completed_at = excluded.completed_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).run(itemId, status, note, startedAt, completedAt, at, by);
  db.prepare('INSERT INTO schedule_log (item_id, status, note, at, by) VALUES (?, ?, ?, ?, ?)').run(itemId, status, note, at, by);
}

/**
 * Moves an item to any status. The first Started/In progress records when it
 * actually began; Completed records when it finished; Upcoming clears both.
 */
export function setStatus(itemId: string, status: ScheduleStatus, by: string) {
  const current = getRow(itemId);
  const before = current && { status: current.status, startedAt: current.started_at, completedAt: current.completed_at };
  const { startedAt, completedAt } = statusTimes(before, status, new Date().toISOString());
  save(itemId, status, current?.note ?? null, startedAt, completedAt, by);
}

/** Sets or clears (empty text) the note guests see under the item. */
export function setNote(itemId: string, note: string, by: string) {
  const current = getRow(itemId);
  const clean = note.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) || null;
  save(itemId, current?.status ?? 'upcoming', clean, current?.started_at ?? null, current?.completed_at ?? null, by);
}

/** Marks an item Completed and the next upcoming item Started. Returns that item's id, if any. */
export function completeAndStartNext(itemId: string, by: string): string | null {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    setStatus(itemId, 'done', by);
    const { items } = getScheduleWithStatus();
    const index = items.findIndex((item) => item.id === itemId);
    const next = items.slice(index + 1).find((item) => item.status === 'upcoming') ?? null;
    if (next) setStatus(next.id, 'starting', by);
    db.exec('COMMIT');
    return next?.id ?? null;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

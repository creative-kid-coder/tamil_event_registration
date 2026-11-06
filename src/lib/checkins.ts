/**
 * Check-ins: in the local SQLite file on the laptop (db.ts), or in one JSON
 * file in Vercel Blob when running on Vercel (blob.ts).
 *
 * Either way two desks can never check in the same party: SQLite inserts in
 * one atomic statement; Blob saves only if nobody changed the file since it
 * was read, and otherwise re-reads (and then sees the first check-in).
 */
import { blobPath, readJson, storageMode, updateJson } from './blob';
import { getDb as open } from './db';
import type { BadgeCounts, CheckIn } from './registrations';

// ---------------------------------------------------------------------------
// Laptop: SQLite
// ---------------------------------------------------------------------------

interface Row {
  ticket_id: string;
  checked_in_at: string;
  checked_in_by: string;
  badges: string;
}

const toCheckIn = (row: Row): CheckIn => ({
  at: row.checked_in_at,
  by: row.checked_in_by,
  badges: JSON.parse(row.badges) as BadgeCounts,
});

const sqlGet = (ticketId: string) => {
  const row = open().prepare('SELECT * FROM checkins WHERE ticket_id = ?').get(ticketId) as unknown as Row | undefined;
  return row ? toCheckIn(row) : null;
};

const disk = {
  all(): Map<string, CheckIn> {
    const rows = open().prepare('SELECT * FROM checkins').all() as unknown as Row[];
    return new Map(rows.map((r) => [r.ticket_id, toCheckIn(r)]));
  },
  get: sqlGet,
  checkIn(ticketId: string, by: string, badges: BadgeCounts) {
    const conn = open();
    const at = new Date().toISOString();
    const json = JSON.stringify(badges);
    const { changes } = conn
      .prepare('INSERT INTO checkins (ticket_id, checked_in_at, checked_in_by, badges) VALUES (?, ?, ?, ?) ON CONFLICT(ticket_id) DO NOTHING')
      .run(ticketId, at, by, json);
    if (changes) {
      conn.prepare("INSERT INTO checkin_log (ticket_id, action, at, by, badges) VALUES (?, 'checkin', ?, ?, ?)").run(ticketId, at, by, json);
    }
    return { created: Boolean(changes), checkIn: sqlGet(ticketId)! };
  },
  undo(ticketId: string, by: string) {
    const conn = open();
    const { changes } = conn.prepare('DELETE FROM checkins WHERE ticket_id = ?').run(ticketId);
    if (changes) {
      conn.prepare("INSERT INTO checkin_log (ticket_id, action, at, by) VALUES (?, 'undo', ?, ?)").run(ticketId, new Date().toISOString(), by);
    }
    return Boolean(changes);
  },
};

// ---------------------------------------------------------------------------
// Vercel: one JSON file in Blob
// ---------------------------------------------------------------------------

interface CheckInFile {
  checkins: Record<string, CheckIn>;
  /** Audit trail, like checkin_log. */
  log: { ticketId: string; action: 'checkin' | 'undo'; at: string; by: string; badges?: BadgeCounts }[];
}

const FILE = blobPath('checkins.json');
const emptyFile = (): CheckInFile => ({ checkins: {}, log: [] });
/** Desk lists may be a few seconds old; checking in always reads fresh. */
const LIST_MAX_AGE_MS = 3000;

const cloud = {
  async all() {
    return new Map(Object.entries((await readJson(FILE, emptyFile, LIST_MAX_AGE_MS)).checkins));
  },
  async get(ticketId: string) {
    return (await readJson(FILE, emptyFile)).checkins[ticketId] ?? null;
  },
  checkIn(ticketId: string, by: string, badges: BadgeCounts) {
    return updateJson(FILE, emptyFile, (doc) => {
      const existing = doc.checkins[ticketId];
      if (existing) return { value: { created: false, checkIn: existing }, save: false };
      const checkIn: CheckIn = { at: new Date().toISOString(), by, badges };
      doc.checkins[ticketId] = checkIn;
      doc.log.push({ ticketId, action: 'checkin', at: checkIn.at, by, badges });
      return { value: { created: true, checkIn }, save: true };
    });
  },
  undo(ticketId: string, by: string) {
    return updateJson(FILE, emptyFile, (doc) => {
      if (!doc.checkins[ticketId]) return { value: false, save: false };
      delete doc.checkins[ticketId];
      doc.log.push({ ticketId, action: 'undo', at: new Date().toISOString(), by });
      return { value: true, save: true };
    });
  },
};

// ---------------------------------------------------------------------------

const store = () => (storageMode() === 'blob' ? cloud : disk);

export async function allCheckIns(): Promise<Map<string, CheckIn>> {
  return store().all();
}

export async function getCheckIn(ticketId: string): Promise<CheckIn | null> {
  return store().get(ticketId);
}

/** Records the check-in unless the party is already checked in. */
export async function checkIn(ticketId: string, by: string, badges: BadgeCounts): Promise<{ created: boolean; checkIn: CheckIn }> {
  return store().checkIn(ticketId, by, badges);
}

/** Removes a check-in (for mistakes). Returns false if the party wasn't checked in. */
export async function undoCheckIn(ticketId: string, by: string): Promise<boolean> {
  return store().undo(ticketId, by);
}

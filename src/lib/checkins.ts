/**
 * Check-ins, stored in the local SQLite file (see db.ts).
 *
 * Node's SQLite API is synchronous, so each check-in is one atomic statement:
 * two desks can never check in the same party.
 */
import { getDb as open } from './db';
import type { BadgeCounts, CheckIn } from './registrations';

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

export function allCheckIns(): Map<string, CheckIn> {
  const rows = open().prepare('SELECT * FROM checkins').all() as unknown as Row[];
  return new Map(rows.map((r) => [r.ticket_id, toCheckIn(r)]));
}

export function getCheckIn(ticketId: string): CheckIn | null {
  const row = open().prepare('SELECT * FROM checkins WHERE ticket_id = ?').get(ticketId) as unknown as Row | undefined;
  return row ? toCheckIn(row) : null;
}

/** Records the check-in unless the party is already checked in. */
export function checkIn(ticketId: string, by: string, badges: BadgeCounts): { created: boolean; checkIn: CheckIn } {
  const conn = open();
  const at = new Date().toISOString();
  const json = JSON.stringify(badges);
  const { changes } = conn
    .prepare('INSERT INTO checkins (ticket_id, checked_in_at, checked_in_by, badges) VALUES (?, ?, ?, ?) ON CONFLICT(ticket_id) DO NOTHING')
    .run(ticketId, at, by, json);
  if (changes) {
    conn.prepare("INSERT INTO checkin_log (ticket_id, action, at, by, badges) VALUES (?, 'checkin', ?, ?, ?)").run(ticketId, at, by, json);
  }
  return { created: Boolean(changes), checkIn: getCheckIn(ticketId)! };
}

/** Removes a check-in (for mistakes). Returns false if the party wasn't checked in. */
export function undoCheckIn(ticketId: string, by: string): boolean {
  const conn = open();
  const { changes } = conn.prepare('DELETE FROM checkins WHERE ticket_id = ?').run(ticketId);
  if (changes) {
    conn.prepare("INSERT INTO checkin_log (ticket_id, action, at, by) VALUES (?, 'undo', ?, ?)").run(ticketId, new Date().toISOString(), by);
  }
  return Boolean(changes);
}

/**
 * The app's local SQLite file (data/checkin.db) using Node's built-in SQLite —
 * no external database. Needs a persistent disk and a single app process,
 * i.e. the venue laptop; it cannot work on Vercel.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as Database } from 'node:sqlite';

// process.getBuiltinModule keeps the bundler away from node:sqlite.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'checkin.db');

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  if (process.env.VERCEL) throw new Error('Check-ins need a persistent disk — run the app on the venue laptop, not Vercel');
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS checkins (
      ticket_id     TEXT PRIMARY KEY,
      checked_in_at TEXT NOT NULL,
      checked_in_by TEXT NOT NULL,
      badges        TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkin_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      action    TEXT NOT NULL CHECK (action IN ('checkin', 'undo')),
      at        TEXT NOT NULL,
      by        TEXT NOT NULL,
      badges    TEXT
    );
    CREATE TABLE IF NOT EXISTS schedule_status (
      item_id      TEXT PRIMARY KEY,
      status       TEXT NOT NULL CHECK (status IN ('upcoming', 'starting', 'live', 'done', 'cancelled')),
      note         TEXT,
      started_at   TEXT,
      completed_at TEXT,
      updated_at   TEXT NOT NULL,
      updated_by   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schedule_log (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      status  TEXT,
      note    TEXT,
      at      TEXT NOT NULL,
      by      TEXT NOT NULL
    );
  `);
  db = conn;
  return conn;
}

/**
 * Dinner boxes: the packing list (data/dinner.csv on the laptop, or the copy
 * uploaded to Vercel Blob) and which families have had their boxes. Handing
 * over works like check-in: two phones can never hand over the same family
 * twice (SQLite inserts atomically; Blob saves only if nobody changed the file
 * since it was read).
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { blob, blobPath, readJson, storageMode, updateJson } from './blob';
import { getDb as open } from './db';
import { parseDinner, type DinnerFamily, type DinnerHandover, type DinnerRow, type ParsedDinner } from './dinner';

/** DINNER_CSV can point elsewhere, e.g. a sample file for a rehearsal. */
export const DINNER_CSV = process.env.DINNER_CSV || path.join(process.cwd(), 'data', 'dinner.csv');
const BLOB_CSV = blobPath('dinner.csv');
const BLOB_RECHECK_MS = 20_000;

// ---------------------------------------------------------------------------
// The packing list
// ---------------------------------------------------------------------------

interface Loaded {
  data: ParsedDinner;
  key: string;
  source: 'local' | 'blob';
  updatedAt: string;
  checkedAt: number;
}
let cached: Loaded | null = null;

const localStat = () => {
  try {
    return statSync(DINNER_CSV);
  } catch {
    return null;
  }
};

async function load(): Promise<Loaded | null> {
  const stat = localStat();
  if (stat) {
    const key = `local:${stat.mtimeMs}:${stat.size}`;
    if (cached?.key !== key) {
      cached = { data: parseDinner(readFileSync(DINNER_CSV, 'utf8')), key, source: 'local', updatedAt: stat.mtime.toISOString(), checkedAt: Date.now() };
    }
    return cached;
  }
  if (!blob().configured()) return null;
  if (cached?.source === 'blob' && Date.now() - cached.checkedAt < BLOB_RECHECK_MS) return cached;
  let file;
  try {
    file = await blob().read(BLOB_CSV);
  } catch (error) {
    if (cached?.source === 'blob') return cached;
    throw error;
  }
  if (!file) return null;
  const key = `blob:${file.etag}`;
  if (cached?.key === key) cached.checkedAt = Date.now();
  else cached = { data: parseDinner(file.text), key, source: 'blob', updatedAt: file.uploadedAt.toISOString(), checkedAt: Date.now() };
  return cached;
}

/** A problem with the uploaded file itself (shown to the admin as-is). */
export class DinnerFileError extends Error {}

export interface DinnerInfo {
  source: 'local' | 'blob' | null;
  updatedAt: string | null;
  /** Required columns the current file is missing. */
  missing: string[];
  uploadTo: 'local' | 'blob' | null;
  uploadBlocked: string | null;
}

function uploadTarget(): { to: 'local' | 'blob' | null; blocked: string | null } {
  if (!process.env.VERCEL) return { to: 'local', blocked: null };
  if (localStat()) return { to: null, blocked: 'This deployment includes data/dinner.csv, which always takes priority.' };
  if (!blob().configured()) return { to: null, blocked: 'Connect a Vercel Blob store to this project to upload the dinner list.' };
  return { to: 'blob', blocked: null };
}

/** The packing list with each family's handed-over status. */
export async function getDinner(): Promise<{ info: DinnerInfo; families: DinnerRow[] }> {
  const { to, blocked } = uploadTarget();
  const loaded = await load();
  const info: DinnerInfo = {
    source: loaded?.source ?? null,
    updatedAt: loaded?.updatedAt ?? null,
    missing: loaded?.data.missing ?? [],
    uploadTo: to,
    uploadBlocked: blocked,
  };
  if (!loaded) return { info, families: [] };
  const handovers = await allHandovers();
  return { info, families: loaded.data.families.map((f) => ({ ...f, handover: handovers.get(f.key) ?? null })) };
}

export async function findFamily(key: string): Promise<DinnerFamily | undefined> {
  return (await load())?.data.families.find((f) => f.key === key);
}

/**
 * Checks and saves a new packing list: to data/dinner.csv on the laptop
 * (keeping the old one as dinner.previous.csv), or to Vercel Blob on Vercel.
 * Handed-over ticks are kept for every family whose name is unchanged.
 */
export async function saveDinner(csv: string): Promise<number> {
  const { to, blocked } = uploadTarget();
  if (!to) throw new DinnerFileError(blocked ?? 'Uploading is not available here');
  let data: ParsedDinner;
  try {
    data = parseDinner(csv);
  } catch (error) {
    throw new DinnerFileError(`That file couldn't be read as a CSV: ${error instanceof Error ? error.message : error}`);
  }
  if (data.missing.length) throw new DinnerFileError(`That file is missing these columns: ${data.missing.join(', ')}.`);
  if (!data.families.length) throw new DinnerFileError('That file has no families in it.');

  if (to === 'local') {
    if (localStat()) copyFileSync(DINNER_CSV, DINNER_CSV.replace(/(\.csv)?$/i, '.previous.csv'));
    mkdirSync(path.dirname(DINNER_CSV), { recursive: true });
    writeFileSync(DINNER_CSV, csv);
  } else {
    await blob().write(BLOB_CSV, csv, { etag: '*', contentType: 'text/csv; charset=utf-8' });
  }
  cached = null;
  return data.families.length;
}

// ---------------------------------------------------------------------------
// Handed over: SQLite on the laptop
// ---------------------------------------------------------------------------

interface Row {
  family_key: string;
  at: string;
  by: string;
  boxes: number;
}
const toHandover = (r: Row): DinnerHandover => ({ at: r.at, by: r.by, boxes: Number(r.boxes) });
const sqlGet = (key: string) => {
  const row = open().prepare('SELECT * FROM dinner_handovers WHERE family_key = ?').get(key) as unknown as Row | undefined;
  return row ? toHandover(row) : null;
};

const disk = {
  all(): Map<string, DinnerHandover> {
    const rows = open().prepare('SELECT * FROM dinner_handovers').all() as unknown as Row[];
    return new Map(rows.map((r) => [r.family_key, toHandover(r)]));
  },
  handOver(key: string, by: string, boxes: number) {
    const conn = open();
    const at = new Date().toISOString();
    const { changes } = conn
      .prepare('INSERT INTO dinner_handovers (family_key, at, by, boxes) VALUES (?, ?, ?, ?) ON CONFLICT(family_key) DO NOTHING')
      .run(key, at, by, boxes);
    if (changes) conn.prepare("INSERT INTO dinner_log (family_key, action, at, by, boxes) VALUES (?, 'handover', ?, ?, ?)").run(key, at, by, boxes);
    return { created: Boolean(changes), handover: sqlGet(key)! };
  },
  undo(key: string, by: string) {
    const conn = open();
    const { changes } = conn.prepare('DELETE FROM dinner_handovers WHERE family_key = ?').run(key);
    if (changes) conn.prepare("INSERT INTO dinner_log (family_key, action, at, by) VALUES (?, 'undo', ?, ?)").run(key, new Date().toISOString(), by);
    return Boolean(changes);
  },
};

// ---------------------------------------------------------------------------
// Handed over: one JSON file in Vercel Blob
// ---------------------------------------------------------------------------

interface HandoverFile {
  handovers: Record<string, DinnerHandover>;
  log: { key: string; action: 'handover' | 'undo'; at: string; by: string; boxes?: number }[];
}
const FILE = blobPath('dinner.json');
const emptyFile = (): HandoverFile => ({ handovers: {}, log: [] });

const cloud = {
  async all() {
    return new Map(Object.entries((await readJson(FILE, emptyFile, 3000)).handovers));
  },
  handOver(key: string, by: string, boxes: number) {
    return updateJson(FILE, emptyFile, (doc) => {
      const existing = doc.handovers[key];
      if (existing) return { value: { created: false, handover: existing }, save: false };
      const handover: DinnerHandover = { at: new Date().toISOString(), by, boxes };
      doc.handovers[key] = handover;
      doc.log.push({ key, action: 'handover', at: handover.at, by, boxes });
      return { value: { created: true, handover }, save: true };
    });
  },
  undo(key: string, by: string) {
    return updateJson(FILE, emptyFile, (doc) => {
      if (!doc.handovers[key]) return { value: false, save: false };
      delete doc.handovers[key];
      doc.log.push({ key, action: 'undo', at: new Date().toISOString(), by });
      return { value: true, save: true };
    });
  },
};

const store = () => (storageMode() === 'blob' ? cloud : disk);

export async function allHandovers(): Promise<Map<string, DinnerHandover>> {
  return store().all();
}

/** Records that a family's boxes were handed over, unless someone already did. */
export async function handOver(key: string, by: string, boxes: number): Promise<{ created: boolean; handover: DinnerHandover }> {
  return store().handOver(key, by, boxes);
}

/** Removes a handed-over tick (for mistakes). False if it wasn't ticked. */
export async function undoHandOver(key: string, by: string): Promise<boolean> {
  return store().undo(key, by);
}

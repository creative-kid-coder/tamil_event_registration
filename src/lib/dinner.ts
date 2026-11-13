/**
 * The dinner packing list: parsing the CSV and counting dinner boxes. No Node
 * APIs here, so the admin page can use it too (loading and storage are in
 * dinnerStore.ts).
 *
 * Columns are found by header name, e.g. "S.No", "Name", "Adults",
 * "Young adults (11–16)", "Juniors (6–10)", "Under 5 (no dinner)", "Total".
 * The sheet's own "Packed / handed over ✓" column is ignored: handing over is
 * ticked in the app.
 */
import { parseCsv } from './csv';

export interface DinnerFamily {
  /** Stable id for the handed-over status: the name, normalised (plus #2, #3… if a name repeats). */
  key: string;
  /** "S.No" from the sheet, as written (may be blank). */
  sno: string;
  name: string;
  adults: number;
  youngAdults: number;
  juniors: number;
  /** Under 5s don't get a dinner box; shown for information. */
  under5: number;
  /** Dinner boxes to hand over: adults + young adults + juniors. */
  boxes: number;
  /** The sheet's "Total" column, if there is one. */
  sheetTotal: number | null;
  warnings: string[];
}

/** A handed-over record (stored in SQLite on the laptop, or Vercel Blob). */
export interface DinnerHandover {
  at: string;
  by: string;
  /** Boxes handed over, as counted at the time. */
  boxes: number;
}

export type DinnerRow = DinnerFamily & { handover: DinnerHandover | null };

export interface ParsedDinner {
  families: DinnerFamily[];
  /** Required columns that couldn't be found. */
  missing: string[];
}

type Column = 'sno' | 'name' | 'adults' | 'youngAdults' | 'juniors' | 'under5' | 'total';

const COLUMNS: { key: Column; label: string; required: boolean; match: (h: string) => boolean }[] = [
  { key: 'sno', label: 'S.No', required: false, match: (h) => /^(s ?no|sl ?no|serial|no|number)\b/.test(h) },
  { key: 'name', label: 'Name', required: true, match: (h) => h === 'name' || h.startsWith('name ') || h.startsWith('family') },
  { key: 'adults', label: 'Adults', required: true, match: (h) => h.startsWith('adult') },
  { key: 'youngAdults', label: 'Young adults (11–16)', required: true, match: (h) => h.startsWith('young') },
  { key: 'juniors', label: 'Juniors (6–10)', required: true, match: (h) => h.startsWith('junior') },
  { key: 'under5', label: 'Under 5', required: false, match: (h) => h.startsWith('under') || h.startsWith('kid') },
  { key: 'total', label: 'Total', required: false, match: (h) => h.startsWith('total') },
];

const normalizeHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** "Narmatha  Rengaraj – own family" → "narmatha rengaraj own family". */
export const nameKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function count(raw: string): { value: number; ok: boolean } {
  const v = raw.trim();
  if (!v || v === '-') return { value: 0, ok: true };
  return /^\d+$/.test(v) ? { value: Number(v), ok: true } : { value: 0, ok: false };
}

export function parseDinner(text: string): ParsedDinner {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((h) => normalizeHeader(String(h ?? '')));
  const index: Partial<Record<Column, number>> = {};
  for (const col of COLUMNS) {
    const i = headers.findIndex((h, n) => col.match(h) && !Object.values(index).includes(n));
    if (i >= 0) index[col.key] = i;
  }
  const missing = COLUMNS.filter((c) => c.required && index[c.key] === undefined).map((c) => c.label);
  if (missing.length) return { families: [], missing };

  const families: DinnerFamily[] = [];
  const seen = new Map<string, number>();

  for (const row of rows.slice(1)) {
    const cell = (col: Column) => (index[col] === undefined ? '' : String(row[index[col]!] ?? '').trim());
    const name = cell('name');
    // Blank lines and the totals line at the bottom have no name.
    if (!name) continue;

    const warnings: string[] = [];
    const num = (col: Column, label: string) => {
      const raw = cell(col);
      const parsed = count(raw);
      if (!parsed.ok) warnings.push(`"${label}" is "${raw}", not a number: counted as 0`);
      return parsed.value;
    };
    const adults = num('adults', 'Adults');
    const youngAdults = num('youngAdults', 'Young adults');
    const juniors = num('juniors', 'Juniors');
    const under5 = num('under5', 'Under 5');
    const boxes = adults + youngAdults + juniors;
    const totalRaw = cell('total');
    const total = totalRaw ? count(totalRaw) : null;
    const sheetTotal = total?.ok ? total.value : null;
    if (total && !total.ok) warnings.push(`"Total" is "${totalRaw}", not a number`);
    // The sheet's Total sometimes includes the under 5s; only flag totals that match neither way.
    if (sheetTotal !== null && sheetTotal !== boxes && sheetTotal !== boxes + under5) {
      warnings.push(`Total in the sheet is ${sheetTotal}, but adults + young adults + juniors make ${boxes} boxes`);
    }
    if (boxes === 0) warnings.push('No dinner boxes: adults, young adults and juniors are all 0');

    const base = nameKey(name) || name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    families.push({ key: n === 1 ? base : `${base} #${n}`, sno: cell('sno'), name, adults, youngAdults, juniors, under5, boxes, sheetTotal, warnings });
  }

  // The same name twice: flag both, so nobody hands over to the wrong one.
  for (const family of families) {
    const base = family.key.replace(/ #\d+$/, '');
    if ((seen.get(base) ?? 0) > 1) family.warnings.push('This name appears more than once in the sheet: check which family is which');
  }

  return { families, missing };
}

/** "4 adults, 1 young adult, 1 junior". */
export function boxMix(f: Pick<DinnerFamily, 'adults' | 'youngAdults' | 'juniors'>): string {
  return (
    [
      [f.adults, 'adult', 'adults'],
      [f.youngAdults, 'young adult', 'young adults'],
      [f.juniors, 'junior', 'juniors'],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(', ');
}

/** True if the family's name, S.No or (with 3+ characters) part of it matches the search. */
export function matchesDinner(f: Pick<DinnerFamily, 'name' | 'sno'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (/^\d+$/.test(q)) return f.sno.trim() === q || nameKey(f.name).includes(q);
  const name = nameKey(f.name);
  return nameKey(q)
    .split(' ')
    .every((token) => name.includes(token));
}

/**
 * Pure parsing / badge logic. No Node APIs, so it runs on the server and in
 * the browser (desk search) alike.
 */
import { BADGES, type BadgeKey } from '@/config/badges';
import { fieldLabel, mapHeaders, type FieldKey, type HeaderMapping } from '@/config/columns';

export type Meal = 'VEG' | 'NON_VEG' | 'UNKNOWN';
export type BadgeCounts = Record<BadgeKey, number>;

export interface Registration {
  /** 1-based row number in the CSV (header is row 1). */
  row: number;
  /** Derived from timestamp + email when the CSV is loaded (see lib/data.ts). */
  ticketId: string;
  timestamp: string;
  email: string;
  firstName: string;
  surname: string;
  mobile: string;
  adult1Meal: Meal;
  adult1MealRaw: string;
  badges: BadgeCounts;
  totalPeople: number;
  volunteering: string;
  culturalProgram: string;
  warnings: string[];
}

/** A recorded check-in (stored in the local SQLite file, see lib/checkins.ts). */
export interface CheckIn {
  /** ISO timestamp. */
  at: string;
  /** Name the desk signed in with. */
  by: string;
  /** Badges handed over at check-in. */
  badges: BadgeCounts;
}

/** A registration as the desk and admin pages see it. */
export type Party = Registration & { checkIn: CheckIn | null };

/** "18:42" in UK time. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
}

export interface ParsedSheet {
  headers: string[];
  mapping: HeaderMapping;
  registrations: Registration[];
}

export function emptyCounts(): BadgeCounts {
  return { adultVeg: 0, adultNonVeg: 0, yaVeg: 0, yaNonVeg: 0, juniorVeg: 0, juniorNonVeg: 0, kids: 0 };
}

export function sumCounts(counts: BadgeCounts): number {
  return BADGES.reduce((total, b) => total + counts[b.key], 0);
}

export function normalizeMeal(value: string): Meal {
  const v = value.toLowerCase();
  if (/non[\s-]*veg/.test(v)) return 'NON_VEG';
  if (/veg/.test(v)) return 'VEG';
  return 'UNKNOWN';
}

export function parseCount(value: string | undefined): { value: number; ok: boolean } {
  const v = (value ?? '').trim();
  if (!v) return { value: 0, ok: true };
  const match = v.match(/^(\d+)/);
  if (match) return { value: Number(match[1]), ok: true };
  if (/^(none|no|nil|n\/a|-)$/i.test(v)) return { value: 0, ok: true };
  return { value: 0, ok: false };
}

/** UK national significant number: digits only, without +44 / 0 prefix. */
export function normalizeMobile(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('44')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

const COUNT_FIELDS: Record<Exclude<BadgeKey, 'adultVeg' | 'adultNonVeg'>, FieldKey> = {
  yaVeg: 'yaVeg',
  yaNonVeg: 'yaNonVeg',
  juniorVeg: 'juniorVeg',
  juniorNonVeg: 'juniorNonVeg',
  kids: 'kids',
};

export function parseRegistrations(values: unknown[][]): ParsedSheet {
  const headers = (values[0] ?? []).map((h) => String(h ?? ''));
  const mapping = mapHeaders(headers);
  const registrations: Registration[] = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const cell = (index: number | undefined) => (index === undefined ? '' : String(row[index] ?? '').trim());
    const field = (key: FieldKey) => cell(mapping.fields[key]);

    const firstName = field('firstName');
    const surname = field('surname');
    const email = field('email');
    const adult1MealRaw = field('adult1Meal');
    if (!firstName && !surname && !email && !adult1MealRaw) continue; // blank row

    const warnings: string[] = [];
    const count = (key: FieldKey) => {
      const raw = field(key);
      const parsed = parseCount(raw);
      if (!parsed.ok) warnings.push(`"${fieldLabel(key)}" is "${raw}" — not a number, treated as 0`);
      return parsed.value;
    };

    const totalAdultsRaw = field('totalAdults');
    const totalAdults = totalAdultsRaw ? parseCount(totalAdultsRaw) : null;
    // Children-only bookings: the form still demands an Adult 1 meal, so TOTAL Adults = 0 overrides it.
    const noAdults = totalAdults?.ok === true && totalAdults.value === 0;

    const adult1Meal = normalizeMeal(adult1MealRaw);
    if (adult1Meal === 'UNKNOWN' && !noAdults) {
      warnings.push(
        adult1MealRaw
          ? `Adult 1 meal "${adult1MealRaw}" not recognised — ask at desk`
          : 'Adult 1 meal is blank — ask at desk',
      );
    }

    const addVeg = count('addAdultVeg');
    const addNonVeg = count('addAdultNonVeg');
    const badges = emptyCounts();
    if (!noAdults) {
      badges.adultVeg = (adult1Meal === 'VEG' ? 1 : 0) + addVeg;
      badges.adultNonVeg = (adult1Meal === 'NON_VEG' ? 1 : 0) + addNonVeg;
    }
    for (const [badgeKey, fieldKey] of Object.entries(COUNT_FIELDS) as [BadgeKey, FieldKey][]) {
      badges[badgeKey] = count(fieldKey);
    }

    if (noAdults) {
      if (addVeg + addNonVeg > 0) {
        warnings.push(`TOTAL Adults in sheet is 0 but additional adult meals give ${addVeg + addNonVeg} — no adult badges given`);
      }
    } else if (totalAdults?.ok) {
      const fromMeals = 1 + addVeg + addNonVeg;
      if (totalAdults.value !== fromMeals) {
        warnings.push(`TOTAL Adults in sheet is ${totalAdults.value} but meal columns give ${fromMeals} — badges follow meal columns`);
      }
    }

    registrations.push({
      row: i + 1,
      ticketId: '',
      timestamp: field('timestamp'),
      email,
      firstName,
      surname,
      mobile: field('mobile'),
      adult1Meal,
      adult1MealRaw,
      badges,
      totalPeople: sumCounts(badges),
      volunteering: field('volunteering'),
      culturalProgram: field('culturalProgram'),
      warnings,
    });
  }

  flagDuplicates(registrations, (r) => r.email.toLowerCase(), 'email');
  flagDuplicates(registrations, (r) => normalizeMobile(r.mobile), 'mobile');

  return { headers, mapping, registrations };
}

function flagDuplicates(regs: Registration[], keyOf: (r: Registration) => string, what: string) {
  const groups = new Map<string, Registration[]>();
  for (const r of regs) {
    const key = keyOf(r);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      const others = group.filter((o) => o !== r).map((o) => `${o.firstName} ${o.surname} (row ${o.row})`);
      r.warnings.push(`Possible Referral — same ${what} as ${others.join(', ')}`);
    }
  }
}

export function fullName(r: Pick<Registration, 'firstName' | 'surname'>): string {
  return `${r.firstName} ${r.surname}`.trim();
}

export function matchesQuery(r: Registration, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const digits = q.replace(/\D/g, '');
  if (digits.length >= 4 && !/[a-z]/.test(q)) {
    const mobile = normalizeMobile(r.mobile);
    if (mobile.includes(digits) || mobile.includes(normalizeMobile(digits)) || r.mobile.replace(/\D/g, '').includes(digits)) {
      return true;
    }
  }

  const compact = q.replace(/[^a-z0-9]/g, '');
  if (compact.length >= 4 && r.ticketId && r.ticketId.replace(/-/g, '').toLowerCase().includes(compact)) return true;

  const haystack = `${r.firstName} ${r.surname} ${r.email}`.toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export function searchRegistrations<T extends Registration>(regs: T[], query: string, limit = 30): T[] {
  return regs
    .filter((r) => matchesQuery(r, query))
    .sort((a, b) => a.surname.localeCompare(b.surname) || a.firstName.localeCompare(b.firstName))
    .slice(0, limit);
}

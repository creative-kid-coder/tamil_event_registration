/**
 * Maps the Google Form response headers to fields by NAME, not position, so
 * reordering columns or adding questions to the form does not break the app.
 */

export type FieldKey =
  | 'timestamp'
  | 'email'
  | 'firstName'
  | 'surname'
  | 'mobile'
  | 'adult1Meal'
  | 'addAdultVeg'
  | 'addAdultNonVeg'
  | 'totalAdults'
  | 'yaVeg'
  | 'yaNonVeg'
  | 'juniorVeg'
  | 'juniorNonVeg'
  | 'kids'
  | 'volunteering'
  | 'culturalProgram';

interface FieldRule {
  key: FieldKey;
  label: string;
  required: boolean;
  match: (normalized: string) => boolean;
}

/** Lowercase, drop "£23"-style prices, collapse punctuation to single spaces. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/£\s*\d+(\.\d+)?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const isNonVeg = (h: string) => /\bnon ?veg/.test(h);
const isVeg = (h: string) => /\bveg/.test(h) && !isNonVeg(h);

export const FIELD_RULES: FieldRule[] = [
  { key: 'timestamp', label: 'Timestamp', required: false, match: (h) => h === 'timestamp' },
  { key: 'email', label: 'Email Address', required: true, match: (h) => h === 'email address' || h === 'email' },
  { key: 'firstName', label: 'First Name', required: true, match: (h) => h.startsWith('first name') },
  { key: 'surname', label: 'Surname', required: true, match: (h) => h.startsWith('surname') || h.startsWith('last name') },
  { key: 'mobile', label: 'Mobile Number', required: true, match: (h) => h.startsWith('mobile') || h.startsWith('phone') },
  { key: 'adult1Meal', label: 'Adult 1 Meal', required: true, match: (h) => h.startsWith('adult 1 meal') },
  { key: 'addAdultVeg', label: 'Additional Adults Veg', required: true, match: (h) => h.startsWith('additional adults') && isVeg(h) },
  { key: 'addAdultNonVeg', label: 'Additional Adults Non-Veg', required: true, match: (h) => h.startsWith('additional adults') && isNonVeg(h) },
  { key: 'totalAdults', label: 'TOTAL Adults (all)', required: false, match: (h) => h.startsWith('total adults') },
  { key: 'yaVeg', label: 'Young Adults (11-16) Veg', required: true, match: (h) => h.startsWith('young adults') && isVeg(h) },
  { key: 'yaNonVeg', label: 'Young Adults (11-16) Non-Veg', required: true, match: (h) => h.startsWith('young adults') && isNonVeg(h) },
  { key: 'juniorVeg', label: 'Juniors (6-10) Veg', required: true, match: (h) => h.startsWith('juniors') && isVeg(h) },
  { key: 'juniorNonVeg', label: 'Juniors (6-10) Non-Veg', required: true, match: (h) => h.startsWith('juniors') && isNonVeg(h) },
  { key: 'kids', label: 'Kids (up to 5) Free', required: true, match: (h) => h.startsWith('kids') },
  { key: 'volunteering', label: 'Volunteering', required: false, match: (h) => h.startsWith('volunteer') },
  { key: 'culturalProgram', label: 'Cultural Program', required: false, match: (h) => h.startsWith('cultural') },
];

export interface HeaderMapping {
  fields: Partial<Record<FieldKey, number>>;
  /** Labels of required form columns that could not be found. */
  missing: string[];
}

export function mapHeaders(headers: string[]): HeaderMapping {
  const fields: HeaderMapping['fields'] = {};

  headers.forEach((raw, index) => {
    const h = normalizeHeader(raw ?? '');
    if (!h) return;
    const rule = FIELD_RULES.find((r) => fields[r.key] === undefined && r.match(h));
    if (rule) fields[rule.key] = index;
  });

  return {
    fields,
    missing: FIELD_RULES.filter((r) => r.required && fields[r.key] === undefined).map((r) => r.label),
  };
}

export function fieldLabel(key: FieldKey): string {
  return FIELD_RULES.find((r) => r.key === key)?.label ?? key;
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapHeaders, normalizeHeader } from '@/config/columns';
import { parseCsv } from '@/lib/csv';
import { findByTicket, loadFromText, ticketIdFor } from '@/lib/data';
import { normalizeTicketId, ticketIdFromScan } from '@/lib/ids';
import { emptyCounts, isMeaningful, matchesQuery, normalizeMeal, normalizeMobile, parseCount, parseRegistrations, partyMix } from '@/lib/registrations';

/** Exact headers from the Google Form responses sheet. */
const FORM_HEADERS = [
  'Timestamp',
  'Email Address',
  'First Name',
  'Surname',
  'Mobile Number',
  'Adult 1 Meal',
  'Additional Adults Veg £23',
  'Additional Adults Non-Veg £23',
  'TOTAL Adults (all)',
  'Young Adults (11-16) Veg £17',
  'Young Adults (11-16) Non-Veg £17',
  'Juniors (6-10) Veg £13',
  'Juniors (6-10) Non-Veg £13',
  'Kids (up to 5) Free',
  'Volunteering',
  'Cultural Program',
  'Total Amount (£)',
  'Payment Status',
  'Payment Date',
];

const SAMPLE_CSV = readFileSync('tests/fixtures/responses.sample.csv', 'utf8');
const SECRET = 'test-secret-123456';

type RowInput = Partial<Record<(typeof FORM_HEADERS)[number], string>>;
const row = (values: RowInput) => FORM_HEADERS.map((h) => values[h] ?? '');

const base: RowInput = {
  Timestamp: '01/10/2026 10:00:00',
  'Email Address': 'priya@example.com',
  'First Name': 'Priya',
  Surname: 'Sharma',
  'Mobile Number': '07700 900123',
  'Adult 1 Meal': 'Veg',
};

describe('header mapping', () => {
  it('maps every required column from the real form headers', () => {
    const mapping = mapHeaders(FORM_HEADERS);
    expect(mapping.missing).toEqual([]);
    expect(mapping.fields.addAdultVeg).toBe(6);
    expect(mapping.fields.addAdultNonVeg).toBe(7);
    expect(mapping.fields.totalAdults).toBe(8);
    expect(mapping.fields.yaVeg).toBe(9);
    expect(mapping.fields.yaNonVeg).toBe(10);
    expect(mapping.fields.juniorVeg).toBe(11);
    expect(mapping.fields.juniorNonVeg).toBe(12);
    expect(mapping.fields.kids).toBe(13);
  });

  it('still maps when columns are reordered and prices change', () => {
    const shuffled = ['Juniors (6-10) Non Veg £15', 'Surname', 'Juniors (6-10) Veg £15', ...FORM_HEADERS.filter((h) => !/^Juniors|^Surname/.test(h))];
    const mapping = mapHeaders(shuffled);
    expect(mapping.missing).toEqual([]);
    expect(mapping.fields.juniorNonVeg).toBe(0);
    expect(mapping.fields.juniorVeg).toBe(2);
  });

  it('reports missing required columns by name', () => {
    const mapping = mapHeaders(FORM_HEADERS.filter((h) => h !== 'Kids (up to 5) Free'));
    expect(mapping.missing).toEqual(['Kids (up to 5) Free']);
  });

  it('normalises headers', () => {
    expect(normalizeHeader('Young Adults (11-16) Non-Veg £17')).toBe('young adults 11 16 non veg');
  });
});

describe('value parsing', () => {
  it.each([
    ['Veg', 'VEG'],
    ['Vegetarian', 'VEG'],
    ['Non-Veg', 'NON_VEG'],
    ['Non Veg', 'NON_VEG'],
    ['nonveg', 'NON_VEG'],
    ['Non-Vegetarian', 'NON_VEG'],
    ['', 'UNKNOWN'],
    ['Chicken', 'UNKNOWN'],
  ])('meal %j → %s', (input, expected) => {
    expect(normalizeMeal(input)).toBe(expected);
  });

  it.each([
    ['', 0, true],
    ['0', 0, true],
    ['2', 2, true],
    ['3 people', 3, true],
    ['None', 0, true],
    ['two', 0, false],
  ])('count %j → %d (ok=%s)', (input, value, ok) => {
    expect(parseCount(input)).toEqual({ value, ok });
  });

  it('normalises UK mobiles', () => {
    expect(normalizeMobile('07700 900123')).toBe('7700900123');
    expect(normalizeMobile('+44 7700 900123')).toBe('7700900123');
    expect(normalizeMobile('7700900123')).toBe('7700900123');
  });
});

describe('badge calculation', () => {
  it('counts Adult 1 into the matching adult category', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row({
        ...base,
        'Additional Adults Veg £23': '1',
        'Additional Adults Non-Veg £23': '2',
        'TOTAL Adults (all)': '4',
        'Young Adults (11-16) Veg £17': '1',
        'Young Adults (11-16) Non-Veg £17': '0',
        'Juniors (6-10) Veg £13': '',
        'Juniors (6-10) Non-Veg £13': '2',
        'Kids (up to 5) Free': '1',
      }),
    ]);
    const [r] = registrations;
    expect(r.badges).toEqual({ adultVeg: 2, adultNonVeg: 2, yaVeg: 1, yaNonVeg: 0, juniorVeg: 0, juniorNonVeg: 2, kids: 1 });
    expect(r.totalPeople).toBe(8);
    expect(r.warnings).toEqual([]);
    expect(r.row).toBe(2);
  });

  it('non-veg Adult 1', () => {
    const { registrations } = parseRegistrations([FORM_HEADERS, row({ ...base, 'Adult 1 Meal': 'Non-Veg', 'TOTAL Adults (all)': '1' })]);
    expect(registrations[0].badges.adultNonVeg).toBe(1);
    expect(registrations[0].badges.adultVeg).toBe(0);
    expect(registrations[0].totalPeople).toBe(1);
  });

  it('warns on unknown Adult 1 meal and gives no adult badge for it', () => {
    const { registrations } = parseRegistrations([FORM_HEADERS, row({ ...base, 'Adult 1 Meal': '' })]);
    expect(registrations[0].badges.adultVeg + registrations[0].badges.adultNonVeg).toBe(0);
    expect(registrations[0].warnings[0]).toMatch(/Adult 1 meal is blank/);
  });

  it('warns when TOTAL Adults disagrees with the meal columns', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row({ ...base, 'Additional Adults Veg £23': '1', 'TOTAL Adults (all)': '3' }),
    ]);
    expect(registrations[0].badges.adultVeg).toBe(2);
    expect(registrations[0].warnings).toContain('TOTAL Adults in sheet is 3 but meal columns give 2 — badges follow meal columns');
  });

  it('gives no adult badges when TOTAL Adults is 0 (children-only booking)', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row({ ...base, 'Adult 1 Meal': 'Non-Veg', 'TOTAL Adults (all)': '0', 'Young Adults (11-16) Non-Veg £17': '1' }),
    ]);
    const [r] = registrations;
    expect(r.badges).toEqual({ ...emptyCounts(), yaNonVeg: 1 });
    expect(r.totalPeople).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it('does not ask for an Adult 1 meal when TOTAL Adults is 0', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row({ ...base, 'Adult 1 Meal': '', 'TOTAL Adults (all)': '0', 'Kids (up to 5) Free': '2' }),
    ]);
    expect(registrations[0].badges).toEqual({ ...emptyCounts(), kids: 2 });
    expect(registrations[0].warnings).toEqual([]);
  });

  it('warns when TOTAL Adults is 0 but additional adult meals are filled in', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row({ ...base, 'TOTAL Adults (all)': '0', 'Additional Adults Veg £23': '2', 'Juniors (6-10) Veg £13': '1' }),
    ]);
    const [r] = registrations;
    expect(r.badges).toEqual({ ...emptyCounts(), juniorVeg: 1 });
    expect(r.warnings).toEqual(['TOTAL Adults in sheet is 0 but additional adult meals give 2 — no adult badges given']);
  });

  it('warns on non-numeric counts', () => {
    const { registrations } = parseRegistrations([FORM_HEADERS, row({ ...base, 'Kids (up to 5) Free': 'two' })]);
    expect(registrations[0].badges.kids).toBe(0);
    expect(registrations[0].warnings[0]).toMatch(/Kids \(up to 5\) Free.*not a number/);
  });

  it('flags duplicates by email and mobile', () => {
    const { registrations } = parseRegistrations([
      FORM_HEADERS,
      row(base),
      row({ ...base, 'First Name': 'P', 'Mobile Number': '+447700900123' }),
      row({ ...base, 'Email Address': 'other@example.com', 'Mobile Number': '07000 000000' }),
    ]);
    expect(registrations[0].warnings.some((w) => w.includes('same email'))).toBe(true);
    expect(registrations[0].warnings.some((w) => w.includes('same mobile'))).toBe(true);
    expect(registrations[2].warnings.some((w) => w.includes('same mobile'))).toBe(false);
  });

  it('skips blank rows and tolerates short rows', () => {
    const { registrations } = parseRegistrations([FORM_HEADERS, [], ['', '', '', ''], ['x', 'a@b.co', 'Only', 'Name']]);
    expect(registrations).toHaveLength(1);
    expect(registrations[0].row).toBe(4);
  });
});

describe('csv', () => {
  it('handles quotes, embedded commas/newlines, CRLF and BOM', () => {
    const text = '﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'say "hi"'],
      ['2', 'line1\nline2', ''],
    ]);
  });

  it('parses the sample responses file', () => {
    const data = loadFromText(SAMPLE_CSV, SECRET);
    expect(data.mapping.missing).toEqual([]);
    expect(data.registrations).toHaveLength(8);
    const rahul = data.registrations.find((r) => r.firstName === 'Rahul')!;
    expect(rahul.culturalProgram).toBe('Song, Dance');
    expect(rahul.badges).toEqual({ adultVeg: 1, adultNonVeg: 2, yaVeg: 0, yaNonVeg: 0, juniorVeg: 1, juniorNonVeg: 1, kids: 2 });
  });
});

describe('ticket ids', () => {
  const reg = { timestamp: '01/10/2026 10:00:00', email: 'Priya@Example.com', firstName: 'Priya', surname: 'Sharma' };

  it('are deterministic, readable and depend on the secret', () => {
    const id = ticketIdFor(reg, 'secret-one-123456');
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(ticketIdFor({ ...reg, email: 'priya@example.com' }, 'secret-one-123456')).toBe(id);
    expect(ticketIdFor(reg, 'secret-two-123456')).not.toBe(id);
    expect(ticketIdFor({ ...reg, timestamp: '01/10/2026 10:00:01' }, 'secret-one-123456')).not.toBe(id);
  });

  it('are unique across the sample and found from typed / scanned text', () => {
    const data = loadFromText(SAMPLE_CSV, SECRET);
    const ids = data.registrations.map((r) => r.ticketId);
    expect(new Set(ids).size).toBe(ids.length);
    const first = data.registrations[0];
    expect(findByTicket(data, first.ticketId.toLowerCase().replace('-', ''))).toBe(first);
    expect(findByTicket(data, 'ZZZZ-ZZZZ')).toBeUndefined();
  });

  it('flags an exactly duplicated response row', () => {
    const lines = SAMPLE_CSV.trim().split('\n');
    const data = loadFromText([...lines, lines[1]].join('\n'), SECRET);
    expect(data.registrations.at(-1)!.warnings.some((w) => w.includes('Same ticket as row 2'))).toBe(true);
  });

  it('normalises typed / scanned ids', () => {
    expect(normalizeTicketId('k7q2 m9xd')).toBe('K7Q2-M9XD');
    expect(normalizeTicketId('K7Q2-M9XO')).toBe('K7Q2-M9X0');
    expect(ticketIdFromScan('https://app.vercel.app/t/K7Q2-M9XD')).toBe('K7Q2-M9XD');
    expect(ticketIdFromScan('K7Q2M9XD')).toBe('K7Q2-M9XD');
  });
});

describe('search', () => {
  const [r] = parseRegistrations([FORM_HEADERS, row(base)]).registrations;
  const withTicket = { ...r, ticketId: 'K7Q2-M9XD' };

  it.each(['priya', 'SHARMA', 'priya sha', '0123', '900123', '07700', '+44 7700', 'k7q2', 'K7Q2-M9XD', 'priya@ex'])('matches %j', (q) => {
    expect(matchesQuery(withTicket, q)).toBe(true);
  });

  it.each(['', 'john', '9999', 'priya smith'])('does not match %j', (q) => {
    expect(matchesQuery(withTicket, q)).toBe(false);
  });
});

describe('not registered yet list', () => {
  it('describes a party by age group, singular and plural', () => {
    expect(partyMix({ ...emptyCounts(), adultVeg: 1, adultNonVeg: 1, juniorVeg: 1, kids: 2 })).toBe('2 adults, 1 junior, 2 kids');
    expect(partyMix({ ...emptyCounts(), adultNonVeg: 1, yaVeg: 1, yaNonVeg: 1 })).toBe('1 adult, 2 young adults');
    expect(partyMix(emptyCounts())).toBe('');
  });

  it('treats blank and "No"-style answers as not taking part', () => {
    for (const answer of ['', 'No', 'none', 'N/A', '-']) expect(isMeaningful(answer)).toBe(false);
    for (const answer of ['Yes', 'Food Serving']) expect(isMeaningful(answer)).toBe(true);
  });
});

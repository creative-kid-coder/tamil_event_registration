import { BADGES } from '@/config/badges';
import { errorResponse } from '@/lib/api';
import { getParties } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Quotes a CSV cell and defuses spreadsheet formula injection (=, @, +x, -x). */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=@]/.test(s) || /^[+-][^\d\s]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ukDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'medium' });

/**
 * Badge list (one row per party, sorted by surname) with check-in status —
 * the printable backup for the desks and a copy of the check-in record.
 */
export async function GET() {
  try {
    const header = [
      'Ticket ID', 'First Name', 'Surname', 'Mobile', 'Email', 'Adult 1 Meal',
      ...BADGES.map((b) => b.label),
      'Total People', 'Volunteering', 'Cultural Program', 'Checked In At', 'Checked In By', 'Warnings',
    ];
    const rows = (await getParties())
      .sort((a, b) => a.surname.localeCompare(b.surname) || a.firstName.localeCompare(b.firstName))
      .map((r) => [
        r.ticketId, r.firstName, r.surname, r.mobile, r.email, r.adult1MealRaw,
        ...BADGES.map((b) => r.badges[b.key]),
        r.totalPeople, r.volunteering, r.culturalProgram,
        r.checkIn ? ukDateTime(r.checkIn.at) : '', r.checkIn?.by ?? '', r.warnings.join(' | '),
      ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

    return new Response('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="badge-list.csv"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

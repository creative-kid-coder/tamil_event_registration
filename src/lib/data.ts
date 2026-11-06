/**
 * Loads registrations from data/responses.csv. Replacing the file is picked up
 * automatically on the next request (no restart needed).
 */
import { createHmac } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv';
import { normalizeTicketId, TICKET_ALPHABET } from './ids';
import { allCheckIns } from './checkins';
import { parseRegistrations, type ParsedSheet, type Party, type Registration } from './registrations';

/** RESPONSES_CSV can point elsewhere, e.g. a sample file for a rehearsal. */
export const CSV_PATH = process.env.RESPONSES_CSV || path.join(process.cwd(), 'data', 'responses.csv');

let cached: { data: ParsedSheet; mtimeMs: number; size: number } | null = null;

function ticketSecret(): string {
  const secret = process.env.TICKET_SECRET;
  if (!secret || secret.length < 16) throw new Error('TICKET_SECRET must be set to at least 16 characters');
  return secret;
}

/**
 * Deterministic ticket id: HMAC of the response's timestamp + email. The same
 * row always gets the same id, so nothing has to be stored — but the secret
 * must never change once QR emails have been sent.
 */
export function ticketIdFor(reg: Pick<Registration, 'timestamp' | 'email' | 'firstName' | 'surname'>, secret: string): string {
  const key = [reg.timestamp, reg.email.toLowerCase(), reg.timestamp ? '' : `${reg.firstName}|${reg.surname}`].join('|');
  const digest = createHmac('sha256', secret).update(key).digest();
  const chars = Array.from(digest.subarray(0, 8), (b) => TICKET_ALPHABET[b % 32]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function loadFromText(csv: string, secret: string): ParsedSheet {
  const data = parseRegistrations(parseCsv(csv));
  const seen = new Map<string, Registration>();
  for (const reg of data.registrations) {
    reg.ticketId = ticketIdFor(reg, secret);
    const clash = seen.get(reg.ticketId);
    if (clash) {
      // Same timestamp + email twice: an exact duplicate row in the CSV.
      reg.warnings.push(`Same ticket as row ${clash.row} — duplicate response`);
      clash.warnings.push(`Same ticket as row ${reg.row} — duplicate response`);
    } else {
      seen.set(reg.ticketId, reg);
    }
  }
  return data;
}

export function getData(): ParsedSheet {
  let stat;
  try {
    stat = statSync(CSV_PATH);
  } catch {
    throw new Error('data/responses.csv not found — export the form responses as CSV and save them there');
  }
  if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
    const data = loadFromText(readFileSync(CSV_PATH, 'utf8'), ticketSecret());
    cached = { data, mtimeMs: stat.mtimeMs, size: stat.size };
  }
  return cached.data;
}

/** Registrations with their check-in status, for the desk and admin pages. */
export function getParties(): Party[] {
  const checkIns = allCheckIns();
  return getData().registrations.map((r) => ({ ...r, checkIn: checkIns.get(r.ticketId) ?? null }));
}

export function findByTicket(data: ParsedSheet, ticketId: string): Registration | undefined {
  const id = normalizeTicketId(ticketId);
  return id ? data.registrations.find((r) => r.ticketId === id) : undefined;
}

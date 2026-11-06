/**
 * Loads registrations from data/responses.csv, or (when there's no local file,
 * e.g. on Vercel) from the copy uploaded to Vercel Blob. Replacing the file is
 * picked up automatically (no restart needed).
 */
import { createHmac } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { blob, blobPath } from './blob';
import { parseCsv } from './csv';
import { normalizeTicketId, TICKET_ALPHABET } from './ids';
import { allCheckIns } from './checkins';
import { parseRegistrations, type ParsedSheet, type Party, type Registration } from './registrations';

/** RESPONSES_CSV can point elsewhere, e.g. a sample file for a rehearsal. */
export const CSV_PATH = process.env.RESPONSES_CSV || path.join(process.cwd(), 'data', 'responses.csv');

/** The uploaded copy in Vercel Blob, used when there's no local file. */
const BLOB_CSV = blobPath('responses.csv');
/** How often another server instance looks for a newer upload. */
const BLOB_RECHECK_MS = 20_000;

interface Loaded {
  data: ParsedSheet;
  key: string;
  source: 'local' | 'blob';
  updatedAt: string;
  checkedAt: number;
}
let cached: Loaded | null = null;

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

const localStat = () => {
  try {
    return statSync(CSV_PATH);
  } catch {
    return null;
  }
};

/**
 * The responses: data/responses.csv when it's there (the laptop), otherwise the
 * copy uploaded to Vercel Blob (e.g. on Vercel, which has no local file).
 */
async function load(): Promise<Loaded> {
  const stat = localStat();
  if (stat) {
    const key = `local:${stat.mtimeMs}:${stat.size}`;
    if (cached?.key !== key) {
      cached = { data: loadFromText(readFileSync(CSV_PATH, 'utf8'), ticketSecret()), key, source: 'local', updatedAt: stat.mtime.toISOString(), checkedAt: Date.now() };
    }
    return cached;
  }

  if (blob().configured()) {
    if (cached?.source === 'blob' && Date.now() - cached.checkedAt < BLOB_RECHECK_MS) return cached;
    let file;
    try {
      file = await blob().read(BLOB_CSV);
    } catch (error) {
      // Keep working from the last copy if Blob can't be reached for a moment.
      if (cached?.source === 'blob') return cached;
      throw error;
    }
    if (file) {
      const key = `blob:${file.etag}`;
      if (cached?.key === key) cached.checkedAt = Date.now();
      else cached = { data: loadFromText(file.text, ticketSecret()), key, source: 'blob', updatedAt: file.uploadedAt.toISOString(), checkedAt: Date.now() };
      return cached;
    }
  }

  throw new Error(
    process.env.VERCEL
      ? 'No responses yet: upload the form responses CSV on the Admin page'
      : 'data/responses.csv not found: export the form responses as CSV and save them there, or upload them on the Admin page',
  );
}

export async function getData(): Promise<ParsedSheet> {
  return (await load()).data;
}

/** Registrations with their check-in status, for the desk and admin pages. */
export async function getParties(): Promise<Party[]> {
  const [data, checkIns] = await Promise.all([getData(), allCheckIns()]);
  return data.registrations.map((r) => ({ ...r, checkIn: checkIns.get(r.ticketId) ?? null }));
}

// ---------------------------------------------------------------------------
// Uploading a new responses file (Admin page)
// ---------------------------------------------------------------------------

/** A problem with the uploaded file itself (shown to the admin as-is). */
export class ResponsesError extends Error {}

export interface ResponsesInfo {
  /** Where the responses are being read from right now. */
  source: 'local' | 'blob' | null;
  updatedAt: string | null;
  families: number;
  missing: string[];
  error: string | null;
  /** Where an upload would be saved, or why uploading isn't possible here. */
  uploadTo: 'local' | 'blob' | null;
  uploadBlocked: string | null;
}

function uploadTarget(): { to: 'local' | 'blob' | null; blocked: string | null } {
  // On the laptop the local folder is preferred and writable.
  if (!process.env.VERCEL) return { to: 'local', blocked: null };
  if (localStat()) {
    return { to: null, blocked: 'This deployment includes data/responses.csv, which always takes priority. Deploy without it to use uploads.' };
  }
  if (!blob().configured()) return { to: null, blocked: 'Connect a Vercel Blob store to this project to upload responses.' };
  return { to: 'blob', blocked: null };
}

export async function responsesInfo(): Promise<ResponsesInfo> {
  const { to, blocked } = uploadTarget();
  try {
    const { data, source, updatedAt } = await load();
    return { source, updatedAt, families: data.registrations.length, missing: data.mapping.missing, error: null, uploadTo: to, uploadBlocked: blocked };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { source: null, updatedAt: null, families: 0, missing: [], error: message, uploadTo: to, uploadBlocked: blocked };
  }
}

/**
 * Checks and saves a new responses CSV: to data/responses.csv on the laptop
 * (keeping the old one as responses.previous.csv), or to Vercel Blob on Vercel.
 */
export async function saveResponses(csv: string): Promise<ResponsesInfo> {
  const { to, blocked } = uploadTarget();
  if (!to) throw new ResponsesError(blocked ?? 'Uploading is not available here');

  let data: ParsedSheet;
  try {
    data = loadFromText(csv, ticketSecret());
  } catch (error) {
    throw new ResponsesError(`That file couldn't be read as a CSV: ${error instanceof Error ? error.message : error}`);
  }
  if (data.mapping.missing.length) {
    throw new ResponsesError(`That file is missing these columns: ${data.mapping.missing.join(', ')}. Export the form responses as CSV and try again.`);
  }
  if (!data.registrations.length) throw new ResponsesError('That file has no responses in it.');

  if (to === 'local') {
    if (localStat()) copyFileSync(CSV_PATH, CSV_PATH.replace(/(\.csv)?$/i, '.previous.csv'));
    mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    writeFileSync(CSV_PATH, csv);
  } else {
    await blob().write(BLOB_CSV, csv, { etag: '*', contentType: 'text/csv; charset=utf-8' });
  }
  cached = null;
  return responsesInfo();
}

export function findByTicket(data: ParsedSheet, ticketId: string): Registration | undefined {
  const id = normalizeTicketId(ticketId);
  return id ? data.registrations.find((r) => r.ticketId === id) : undefined;
}

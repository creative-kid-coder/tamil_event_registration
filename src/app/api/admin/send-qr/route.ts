import { NextResponse } from 'next/server';
import { publicBaseUrl } from '@/config/event';
import { errorResponse, readJson } from '@/lib/api';
import { getData } from '@/lib/data';
import { normalizeTicketId } from '@/lib/ids';
import type { Registration } from '@/lib/registrations';
import { createTransport, emailFrom, GmailAuthError, sendTicketEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Emails per request — keeps each request short so the page can show progress and pause. */
const BATCH_SIZE = 10;
/** A steady pace keeps Gmail from flagging the burst as spam. */
const PAUSE_MS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every registration with an email, in CSV order. Sending walks this list by position. */
const recipients = async () => (await getData()).registrations.filter((r) => r.email);

/** Whether email sending is configured, and from which address. */
export async function GET() {
  try {
    let from: string | null = null;
    try {
      from = emailFrom();
    } catch {}
    // No responses loaded yet is fine here: there's just nobody to email.
    const total = await recipients().then((list) => list.length, () => 0);
    return NextResponse.json({
      configured: Boolean(from),
      from,
      testTo: process.env.EMAIL_REPLY_TO || from || '',
      // Where the QR codes and links in the emails point (null: just the ticket ID).
      linkBase: publicBaseUrl(),
      total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

interface Body {
  mode: 'test' | 'batch' | 'selected';
  /** Where the test email goes. */
  to: string;
  /** Position in the recipient list to continue from. */
  offset: number;
  /** Ticket IDs of the people to email (mode 'selected', at most BATCH_SIZE per request). */
  ticketIds: string[];
}

type Failure = { row: number; name: string; error: string };

/** Sends each ticket email at a steady pace. A Gmail login failure aborts the whole run. */
async function sendEach(regs: Registration[]) {
  const failed: Failure[] = [];
  let sent = 0;
  const transport = createTransport();
  try {
    for (const reg of regs) {
      const name = `${reg.firstName} ${reg.surname}`;
      if (!EMAIL_RE.test(reg.email)) {
        failed.push({ row: reg.row, name, error: `Invalid email "${reg.email}"` });
        continue;
      }
      try {
        await sendTicketEmail(transport, reg);
        sent++;
      } catch (error) {
        // A login problem affects every email — stop instead of failing them one by one.
        if (error instanceof GmailAuthError) throw error;
        failed.push({ row: reg.row, name, error: error instanceof Error ? error.message : String(error) });
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  } finally {
    transport.close();
  }
  return { sent, failed };
}

export async function POST(req: Request) {
  try {
    const body = await readJson<Body>(req);
    const list = await recipients();

    if (body.mode === 'test') {
      const to = String(body.to ?? '').trim();
      if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Enter a valid email address for the test' }, { status: 400 });
      const sample = list[0];
      if (!sample) return NextResponse.json({ error: 'No registrations with an email address' }, { status: 400 });
      const transport = createTransport();
      try {
        await sendTicketEmail(transport, sample, { to, test: true });
      } finally {
        transport.close();
      }
      return NextResponse.json({ sentTo: to, sampleOf: `${sample.firstName} ${sample.surname}` });
    }

    if (body.mode === 'selected') {
      const ids = Array.isArray(body.ticketIds) ? body.ticketIds.map((id) => normalizeTicketId(String(id))) : [];
      if (!ids.length) return NextResponse.json({ error: 'Select at least one person' }, { status: 400 });
      if (ids.length > BATCH_SIZE) return NextResponse.json({ error: `Send at most ${BATCH_SIZE} per request` }, { status: 400 });
      const regs = list.filter((r) => ids.includes(r.ticketId));
      const { sent, failed } = await sendEach(regs);
      // The CSV may have changed since the page loaded.
      const notFound = ids.length - regs.length;
      if (notFound) failed.push({ row: 0, name: `${notFound} selected`, error: 'No longer in the responses file, or has no email' });
      return NextResponse.json({ sent, failed });
    }

    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    const { sent, failed } = await sendEach(list.slice(offset, offset + BATCH_SIZE));

    return NextResponse.json({
      sent,
      failed,
      nextOffset: Math.min(offset + BATCH_SIZE, list.length),
      total: list.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

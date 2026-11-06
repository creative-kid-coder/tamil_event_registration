/**
 * QR emails sent through Gmail's SMTP server with an app password. Gmail is
 * used only to send — the app never reads the mailbox or uses Google sign-in.
 */
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import QRCode from 'qrcode';
import { BADGES } from '@/config/badges';
import { EVENT, ticketUrl } from '@/config/event';
import type { Registration } from './registrations';

function gmailCredentials() {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop").
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
  return { user, pass };
}

export function emailFrom(): string {
  return gmailCredentials().user;
}

/** One SMTP connection reused for a batch; close it when the batch is done. */
export function createTransport(): Transporter {
  return nodemailer.createTransport({ service: 'gmail', auth: gmailCredentials(), pool: true, maxConnections: 1 });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Builds the QR email (QR embedded inline, since many clients block data: images). */
export async function composeTicketEmail(reg: Registration, options: { to?: string; test?: boolean } = {}): Promise<SendMailOptions> {
  const url = ticketUrl(reg.ticketId);
  // The desk scanner reads the ticket id from either a /t/<id> link or the bare id.
  const qrPng = await QRCode.toBuffer(url ?? reg.ticketId, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
  const lines = BADGES.filter((b) => reg.badges[b.key] > 0);
  const name = escapeHtml(reg.firstName);
  const when = [EVENT.date, EVENT.venue].filter(Boolean);

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
  <h2 style="margin:0 0 4px">${escapeHtml(EVENT.name)}</h2>
  ${when.map((w) => `<div style="color:#475569">${escapeHtml(w)}</div>`).join('')}
  <p>Hi ${name},</p>
  <p>Thank you for registering. Please show this QR code at the check-in desk when you arrive.</p>
  <div style="text-align:center;margin:16px 0">
    <img src="cid:ticket-qr" width="240" height="240" alt="Check-in QR code" style="display:inline-block">
    <div style="font-family:monospace;font-size:20px;letter-spacing:2px;margin-top:8px">${escapeHtml(reg.ticketId)}</div>
  </div>
  <h3 style="margin-bottom:6px">Your booking</h3>
  <table style="border-collapse:collapse;width:100%">
    ${lines
      .map(
        (b) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(b.label)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">${reg.badges[b.key]}</td>
    </tr>`,
      )
      .join('')}
    <tr><td style="padding:6px 8px;font-weight:bold">Total people</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${reg.totalPeople}</td></tr>
  </table>
  <p style="background:#fef3c7;padding:10px;border-radius:6px">If anything above is wrong, please reply to this email before the event so we can fix it.</p>
  ${url ? `<p style="font-size:12px;color:#64748b">Can't see the QR code? Open <a href="${url}">${url}</a> on your phone.</p>` : ''}
</div>`;

  const text = [
    EVENT.name,
    ...when,
    '',
    `Hi ${reg.firstName},`,
    'Please show your QR code at the check-in desk when you arrive.',
    `Ticket: ${reg.ticketId}`,
    ...(url ? [`QR code / booking: ${url}`] : []),
    '',
    'Your booking:',
    ...lines.map((b) => `  ${b.label}: ${reg.badges[b.key]}`),
    `  Total people: ${reg.totalPeople}`,
    '',
    'If anything above is wrong, please reply to this email before the event.',
  ].join('\n');

  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return {
    from: { name: EVENT.name, address: emailFrom() },
    to: options.to ?? reg.email,
    ...(replyTo ? { replyTo } : {}),
    subject: `${options.test ? '[TEST] ' : ''}Your check-in QR code – ${EVENT.name}`,
    text,
    html,
    attachments: [{ filename: 'checkin-qr.png', content: qrPng, cid: 'ticket-qr' }],
  };
}

export class GmailAuthError extends Error {}

export async function sendTicketEmail(
  transport: Transporter,
  reg: Registration,
  options: { to?: string; test?: boolean } = {},
): Promise<void> {
  try {
    await transport.sendMail(await composeTicketEmail(reg, options));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'EAUTH') {
      throw new GmailAuthError('Gmail rejected the login — check GMAIL_USER and GMAIL_APP_PASSWORD (an app password, not your normal password)');
    }
    throw error;
  }
}

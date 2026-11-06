import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFromText } from '@/lib/data';
import { composeTicketEmail } from '@/lib/mailer';

describe('ticket email', () => {
  it('has the QR inline, the ticket link and the booking summary', async () => {
    process.env.PUBLIC_BASE_URL = 'https://checkin.example.com/';
    process.env.GMAIL_USER = 'organiser@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    process.env.EMAIL_REPLY_TO = 'organiser@example.com';
    const reg = loadFromText(readFileSync('tests/fixtures/responses.sample.csv', 'utf8'), 'test-secret-123456').registrations[0];

    const email = await composeTicketEmail(reg);

    expect(email.to).toBe('priya.sharma@example.com');
    expect(email.from).toMatchObject({ address: 'organiser@gmail.com' });
    expect(email.replyTo).toBe('organiser@example.com');
    expect(email.html).toContain('src="cid:ticket-qr"');
    expect(email.attachments?.[0]).toMatchObject({ cid: 'ticket-qr', filename: 'checkin-qr.png' });
    expect(Buffer.isBuffer(email.attachments?.[0].content)).toBe(true);
    expect(email.html).toContain(`https://checkin.example.com/t/${reg.ticketId}`);
    expect(email.text).toContain('Total people: 5');
  });

  it('sends the test copy to the given address', async () => {
    const reg = loadFromText(readFileSync('tests/fixtures/responses.sample.csv', 'utf8'), 'test-secret-123456').registrations[0];
    const email = await composeTicketEmail(reg, { to: 'admin@example.com', test: true });
    expect(email.to).toBe('admin@example.com');
    expect(email.subject).toMatch(/^\[TEST\]/);
  });
});

describe('ticket email without PUBLIC_BASE_URL', () => {
  it('omits the link (the QR then holds just the ticket id)', async () => {
    delete process.env.PUBLIC_BASE_URL;
    const reg = loadFromText(readFileSync('tests/fixtures/responses.sample.csv', 'utf8'), 'test-secret-123456').registrations[0];
    const email = await composeTicketEmail(reg);
    expect(email.html).not.toContain('/t/');
    expect(email.text).not.toContain('/t/');
    expect(email.html).toContain(reg.ticketId);
  });
});

describe('Gmail sending', () => {
  it('builds a valid MIME message with the QR inline (no network)', async () => {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const reg = loadFromText(readFileSync('tests/fixtures/responses.sample.csv', 'utf8'), 'test-secret-123456').registrations[0];
    const info = await transport.sendMail(await composeTicketEmail(reg));
    const raw = (info.message as Buffer).toString('utf8');
    expect(raw).toMatch(/^From: .*<organiser@gmail\.com>/m);
    expect(raw).toMatch(/^To: priya\.sharma@example\.com/m);
    expect(raw).toMatch(/^Content-ID: <ticket-qr>/im);
    expect(raw).toMatch(/^Content-Type: image\/png/m);
  });
});

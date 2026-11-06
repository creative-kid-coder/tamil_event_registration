import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { blobPath, setBlobClient } from '@/lib/blob';
import { emptyCounts } from '@/lib/registrations';
import { memoryBlob } from './memoryBlob';

const SAMPLE = readFileSync(path.join(__dirname, 'fixtures', 'responses.sample.csv'), 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'blob-test-'));
const localCsv = path.join(dir, 'responses.csv');
const fake = memoryBlob();
let data: typeof import('@/lib/data');
let checkins: typeof import('@/lib/checkins');

beforeAll(async () => {
  process.env.TICKET_SECRET = 'test-ticket-secret-0123456789';
  process.env.RESPONSES_CSV = localCsv; // doesn't exist yet: like a Vercel deployment
  process.env.VERCEL = '1';
  setBlobClient(fake);
  data = await import('@/lib/data');
  checkins = await import('@/lib/checkins');
});

afterAll(() => {
  delete process.env.VERCEL;
  setBlobClient(null);
  rmSync(dir, { recursive: true, force: true });
});

describe('responses on Vercel (Blob)', () => {
  it('says there are none yet, and that uploads go to Blob', async () => {
    const info = await data.responsesInfo();
    expect(info).toMatchObject({ source: null, uploadTo: 'blob', uploadBlocked: null });
    expect(info.error).toMatch(/upload the form responses CSV/i);
  });

  it('rejects a file that is not the form export, and saves nothing', async () => {
    await expect(data.saveResponses('Name,Phone\nPriya,07700 900123\n')).rejects.toThrow(/missing these columns/);
    expect(fake.files.has(blobPath('responses.csv'))).toBe(false);
  });

  it('saves an upload privately to Blob and reads it back', async () => {
    const info = await data.saveResponses(SAMPLE);
    expect(info).toMatchObject({ source: 'blob', families: 8, missing: [] });
    expect(fake.files.get(blobPath('responses.csv'))?.text).toBe(SAMPLE);
    expect((await data.getData()).registrations).toHaveLength(8);
  });

  it('prefers a local file when there is one, and then blocks uploads (they would be ignored)', async () => {
    writeFileSync(localCsv, SAMPLE.split('\n').slice(0, 3).join('\n') + '\n');
    const info = await data.responsesInfo();
    expect(info).toMatchObject({ source: 'local', families: 2, uploadTo: null });
    expect(info.uploadBlocked).toMatch(/takes priority/);
    await expect(data.saveResponses(SAMPLE)).rejects.toThrow(/takes priority/);
    rmSync(localCsv);
    expect((await data.responsesInfo()).source).toBe('blob');
  });
});

describe('check-ins on Vercel (Blob)', () => {
  const badges = { ...emptyCounts(), adultVeg: 2 };

  it('lets exactly one of several desks check a party in at the same moment', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => checkins.checkIn('AAAA-1111', `Desk ${n}`, badges)));
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const winner = results.find((r) => r.created)!.checkIn;
    for (const r of results) expect(r.checkIn).toEqual(winner);
  });

  it('one desk can check in party after party (the saved file is re-read with a writable ETag)', async () => {
    for (const t of ['CCCC-0001', 'CCCC-0002', 'CCCC-0003']) {
      expect((await checkins.checkIn(t, 'Desk 1', badges)).created).toBe(true);
    }
    // The desk list, read the plain way, sees them all.
    const all = await checkins.allCheckIns();
    expect(['CCCC-0001', 'CCCC-0002', 'CCCC-0003'].every((t) => all.has(t))).toBe(true);
  });

  it('keeps every check-in when different parties arrive at once', async () => {
    const tickets = Array.from({ length: 12 }, (_, i) => `BBBB-${String(i).padStart(4, '0')}`);
    await Promise.all(tickets.map((t, i) => checkins.checkIn(t, `Desk ${(i % 3) + 1}`, badges)));
    const all = await checkins.allCheckIns();
    expect(tickets.every((t) => all.has(t))).toBe(true);
    expect(all.size).toBe(16);
  });

  it('undo frees the party, and both are in the audit log', async () => {
    expect(await checkins.undoCheckIn('AAAA-1111', 'Desk 1')).toBe(true);
    expect(await checkins.undoCheckIn('AAAA-1111', 'Desk 1')).toBe(false);
    expect(await checkins.getCheckIn('AAAA-1111')).toBeNull();
    const file = JSON.parse(fake.files.get(blobPath('checkins.json'))!.text);
    expect(file.log.filter((e: { ticketId: string }) => e.ticketId === 'AAAA-1111').map((e: { action: string }) => e.action)).toEqual(['checkin', 'undo']);
  });
});

describe('responses on the laptop', () => {
  it('saves an upload to the local file, keeping the previous one', async () => {
    delete process.env.VERCEL;
    writeFileSync(localCsv, 'old file');
    const info = await data.saveResponses(SAMPLE);
    expect(info).toMatchObject({ source: 'local', families: 8, uploadTo: 'local' });
    expect(readFileSync(localCsv, 'utf8')).toBe(SAMPLE);
    expect(readFileSync(localCsv.replace(/\.csv$/, '.previous.csv'), 'utf8')).toBe('old file');
    expect(existsSync(localCsv)).toBe(true);
  });
});

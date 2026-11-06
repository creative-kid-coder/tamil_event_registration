import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyCounts } from '@/lib/registrations';

const dir = mkdtempSync(path.join(tmpdir(), 'checkin-test-'));
let store: typeof import('@/lib/checkins');

beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'checkin.db');
  store = await import('@/lib/checkins');
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {} // Windows may keep the WAL files locked until the process exits
});

describe('check-in store (SQLite)', () => {
  const badges = { ...emptyCounts(), adultVeg: 2, kids: 1 };

  it('records a check-in once and refuses a second desk', async () => {
    const first = await store.checkIn('AAAA-1111', 'Desk 1', badges);
    expect(first.created).toBe(true);
    expect(first.checkIn).toMatchObject({ by: 'Desk 1', badges });

    const second = await store.checkIn('AAAA-1111', 'Desk 2', emptyCounts());
    expect(second.created).toBe(false);
    expect(second.checkIn.by).toBe('Desk 1');
    expect(second.checkIn.at).toBe(first.checkIn.at);
    expect(second.checkIn.badges).toEqual(badges);
  });

  it('lists all check-ins', async () => {
    await store.checkIn('BBBB-2222', 'Desk 2', emptyCounts());
    const all = await store.allCheckIns();
    expect([...all.keys()].sort()).toEqual(['AAAA-1111', 'BBBB-2222']);
  });

  it('undo frees the party for a fresh check-in', async () => {
    expect(await store.undoCheckIn('AAAA-1111', 'Desk 1')).toBe(true);
    expect(await store.undoCheckIn('AAAA-1111', 'Desk 1')).toBe(false);
    expect(await store.getCheckIn('AAAA-1111')).toBeNull();
    expect((await store.checkIn('AAAA-1111', 'Desk 3', badges)).created).toBe(true);
    expect((await store.getCheckIn('AAAA-1111'))?.by).toBe('Desk 3');
  });
});

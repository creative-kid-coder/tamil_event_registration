import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setBlobClient } from '@/lib/blob';
import { boxMix, matchesDinner, parseDinner } from '@/lib/dinner';
import { memoryBlob } from './memoryBlob';

// Made-up families, in the same layout as the real packing list (including its ✓ column and totals line).
const HEADER = 'Packed / handed over ✓,S.No,Name,Adults,Young adults (11–16),Juniors (6–10),Under 5 (no dinner),Total';
const SHEET = [
  HEADER,
  '☐,1,Asha Kumar,4,1,1,0,6',
  '☐,2,Bala Raman,4,,1,1,6',
  '☐,3,Chitra Devi – own family,2,2,0,0,4',
  '☐,4,Chitra Devi – referred family,2,2,0,0,4',
  '☐,5,Dinesh Mani,1,1,1,1,3',
  '☑,6,Esther Paul,2,x,0,0,9',
  '☐,7,Asha Kumar,1,0,0,0,1',
  '☐,8,Sponsors (2 dinners required),2,0,0,0,2',
  ',,,18,6,3,2,35',
  '',
].join('\r\n');

describe('parseDinner', () => {
  const { families, missing } = parseDinner('﻿' + SHEET);

  it('finds the columns by name and skips the totals line', () => {
    expect(missing).toEqual([]);
    expect(families.map((f) => f.sno)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('counts a box for each adult, young adult and junior, but not under 5s', () => {
    expect(families[0]).toMatchObject({ name: 'Asha Kumar', adults: 4, youngAdults: 1, juniors: 1, under5: 0, boxes: 6, sheetTotal: 6 });
    // A blank cell is 0; the sheet's Total here also counts the under 5.
    expect(families[1]).toMatchObject({ youngAdults: 0, under5: 1, boxes: 5, sheetTotal: 6, warnings: [] });
    expect(families[4]).toMatchObject({ boxes: 3, under5: 1, warnings: [] });
    expect(families[7].boxes).toBe(2);
  });

  it('flags cells that are not numbers and totals that do not add up', () => {
    expect(families[5].boxes).toBe(2);
    expect(families[5].warnings.join(' ')).toContain('"Young adults" is "x"');
    expect(families[5].warnings.join(' ')).toContain('Total in the sheet is 9');
  });

  it('gives every family its own key, even when a name repeats', () => {
    expect(new Set(families.map((f) => f.key)).size).toBe(families.length);
    expect(families[2].key).toBe('chitra devi own family');
    expect(families[6].key).toBe('asha kumar #2');
    expect(families[0].warnings.join(' ')).toContain('appears more than once');
    expect(families[2].warnings).toEqual([]);
  });

  it('reports missing columns', () => {
    expect(parseDinner('Name,Adults\nX,1').missing).toEqual(['Young adults (11–16)', 'Juniors (6–10)']);
  });

  it('describes the boxes and searches by name or S.No', () => {
    expect(boxMix(families[0])).toBe('4 adults, 1 young adult, 1 junior');
    expect(boxMix(families[7])).toBe('2 adults');
    expect(matchesDinner(families[2], 'chitra own')).toBe(true);
    expect(matchesDinner(families[2], '3')).toBe(true);
    expect(matchesDinner(families[2], '4')).toBe(false);
    expect(matchesDinner(families[2], '')).toBe(true);
  });
});

describe('dinner store', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dinner-test-'));
  let store: typeof import('@/lib/dinnerStore');

  beforeAll(async () => {
    process.env.DB_PATH = path.join(dir, 'checkin.db');
    process.env.DINNER_CSV = path.join(dir, 'dinner.csv');
    store = await import('@/lib/dinnerStore');
  });

  afterAll(() => {
    delete process.env.STORAGE;
    setBlobClient(null);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {} // Windows may keep the WAL files locked until the process exits
  });

  it('has an empty list until a CSV is uploaded', async () => {
    const { info, families } = await store.getDinner();
    expect(families).toEqual([]);
    expect(info).toMatchObject({ source: null, uploadTo: 'local', missing: [] });
  });

  it('refuses a file without the right columns, and saves a good one', async () => {
    await expect(store.saveDinner('Name,Adults\nX,1')).rejects.toThrow('missing these columns');
    await expect(store.saveDinner(HEADER)).rejects.toThrow('no families');
    expect(await store.saveDinner(SHEET)).toBe(8);
    const { info, families } = await store.getDinner();
    expect(info.source).toBe('local');
    expect(families).toHaveLength(8);
    expect(families.every((f) => f.handover === null)).toBe(true);
  });

  describe.each([
    ['laptop (SQLite)', () => delete process.env.STORAGE],
    [
      'Vercel (Blob)',
      () => {
        process.env.STORAGE = 'blob';
        setBlobClient(memoryBlob());
      },
    ],
  ])('handing over on the %s', (_name, useBackend) => {
    const key = 'bala raman';
    beforeAll(useBackend);

    it('records a hand-over once and refuses a second phone', async () => {
      const first = await store.handOver(key, 'Admin 1', 5);
      expect(first).toMatchObject({ created: true, handover: { by: 'Admin 1', boxes: 5 } });
      const second = await store.handOver(key, 'Admin 2', 5);
      expect(second.created).toBe(false);
      expect(second.handover).toEqual(first.handover);
      expect((await store.getDinner()).families.find((f) => f.key === key)?.handover?.by).toBe('Admin 1');
    });

    it('two phones at the same moment: only one wins', async () => {
      const results = await Promise.all([store.handOver('dinesh mani', 'A', 3), store.handOver('dinesh mani', 'B', 3)]);
      expect(results.filter((r) => r.created)).toHaveLength(1);
    });

    it('undo puts the family back on the list', async () => {
      expect(await store.undoHandOver(key, 'Admin 1')).toBe(true);
      expect(await store.undoHandOver(key, 'Admin 1')).toBe(false);
      expect((await store.getDinner()).families.find((f) => f.key === key)?.handover).toBeNull();
      expect((await store.handOver(key, 'Admin 3', 5)).created).toBe(true);
    });

    it('keeps the ticks when the list is uploaded again', async () => {
      await store.saveDinner(SHEET.replace('Esther Paul', 'Esther Paulraj'));
      const families = (await store.getDinner()).families;
      expect(families.find((f) => f.key === key)?.handover?.by).toBe('Admin 3');
      expect(families.find((f) => f.name === 'Esther Paulraj')).toBeTruthy();
    });
  });

  it('finds a family by key', async () => {
    expect((await store.findFamily('asha kumar #2'))?.sno).toBe('7');
    expect(await store.findFamily('nobody')).toBeUndefined();
  });
});

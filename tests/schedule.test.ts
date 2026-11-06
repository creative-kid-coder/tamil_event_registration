import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupSchedule, nowAndNext, parseSchedule, statusTimes, type ScheduledItem, type ScheduleStatus } from '@/lib/schedule';

const items = (list: object[]) => JSON.stringify({ items: list });

describe('parseSchedule', () => {
  it('sorts by start time, keeping file order for equal times', () => {
    const parsed = parseSchedule(
      items([
        { id: 'c', title: 'C', start: '19:00' },
        { id: 'a', title: 'A', start: '9:05', end: '10:00', kind: 'stage' },
        { id: 'b1', title: 'B1', start: '17:30' },
        { id: 'b2', title: 'B2', start: '17:30', kind: 'nonsense' },
      ]),
    );
    expect(parsed.map((i) => i.id)).toEqual(['a', 'b1', 'b2', 'c']);
    expect(parsed[0]).toMatchObject({ start: '09:05', end: '10:00', kind: 'stage' });
    expect(parsed[2].kind).toBe('other');
  });

  it('accepts a bare list', () => {
    expect(parseSchedule(JSON.stringify([{ id: 'x', title: 'X', start: '18:00' }]))).toHaveLength(1);
  });

  it('reports every problem at once', () => {
    let message = '';
    try {
      parseSchedule(
        items([
          { id: 'a', title: 'A', start: '18:00' },
          { id: 'a', title: 'Again', start: '18:30' },
          { id: 'b', start: '19:00' },
          { id: 'c', title: 'C', start: '25:00' },
          { id: 'd', title: 'D', start: '18:00', end: 'late' },
        ]),
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('id "a" is used twice');
    expect(message).toContain('Item 3: missing "title"');
    expect(message).toContain('"start" must be a time like 18:30 (got "25:00")');
    expect(message).toContain('"end" must be a time like 19:15 (got "late")');
  });

  it('rejects broken JSON and a missing list', () => {
    expect(() => parseSchedule('{ items: [')).toThrow(/not valid JSON/);
    expect(() => parseSchedule('{}')).toThrow(/"items" list/);
  });
});

describe('nowAndNext', () => {
  const item = (id: string, start: string, status: ScheduleStatus = 'upcoming'): ScheduledItem => ({
    id,
    title: id,
    start,
    kind: 'other',
    status,
    note: null,
    startedAt: null,
    completedAt: null,
  });

  it('before anything starts, next is the first item (and anything at the same time)', () => {
    const { now, next } = nowAndNext([item('a', '17:00'), item('b', '17:00'), item('c', '18:00')]);
    expect(now).toEqual([]);
    expect(next.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('shows every started or in-progress item as now', () => {
    const { now, next } = nowAndNext([item('a', '17:00', 'done'), item('b', '17:30', 'live'), item('c', '17:30', 'starting'), item('d', '19:00')]);
    expect(now.map((i) => i.id)).toEqual(['b', 'c']);
    expect(next.map((i) => i.id)).toEqual(['d']);
  });

  it('does not offer an item that was skipped without being marked', () => {
    const { next } = nowAndNext([item('a', '17:00'), item('b', '17:30', 'live'), item('c', '18:00')]);
    expect(next.map((i) => i.id)).toEqual(['c']);
  });

  it('cancelling a later item in advance does not change what is next', () => {
    const { next } = nowAndNext([item('a', '17:00', 'live'), item('b', '18:00'), item('c', '19:00', 'cancelled'), item('d', '20:00')]);
    expect(next.map((i) => i.id)).toEqual(['b']);
  });

  it('is empty when everything is finished', () => {
    expect(nowAndNext([item('a', '17:00', 'done'), item('b', '18:00', 'cancelled')])).toEqual({ now: [], next: [] });
  });

  describe('statusTimes', () => {
    const t1 = '2026-11-14T17:00:00.000Z';
    const t2 = '2026-11-14T18:00:00.000Z';

    it('records the first start and keeps it', () => {
      const started = statusTimes(undefined, 'starting', t1);
      expect(started).toEqual({ startedAt: t1, completedAt: null });
      expect(statusTimes({ status: 'starting', ...started }, 'live', t2)).toEqual({ startedAt: t1, completedAt: null });
    });

    it('records the finish once, and clears both on Upcoming', () => {
      const done = statusTimes({ status: 'live', startedAt: t1, completedAt: null }, 'done', t2);
      expect(done).toEqual({ startedAt: t1, completedAt: t2 });
      expect(statusTimes({ status: 'done', ...done }, 'done', '2026-11-14T19:00:00.000Z')).toEqual(done);
      expect(statusTimes({ status: 'done', ...done }, 'live', t2)).toEqual({ startedAt: t1, completedAt: null });
      expect(statusTimes({ status: 'done', ...done }, 'upcoming', t2)).toEqual({ startedAt: null, completedAt: null });
    });
  });

  describe('groupSchedule', () => {
    const ids = (list: ScheduledItem[]) => list.map((i) => i.id);

    it('puts every item in exactly one group', () => {
      const all = [
        item('doors', '16:30', 'done'),
        item('skipped', '16:45', 'cancelled'),
        item('show', '17:30', 'live'),
        item('kids', '17:30', 'starting'),
        item('dinner', '19:00'),
        item('raffle', '19:30', 'cancelled'),
        item('games', '20:00'),
      ];
      const g = groupSchedule(all);
      expect(ids(g.now)).toEqual(['show', 'kids']);
      expect(ids(g.next)).toEqual(['dinner']);
      expect(ids(g.later)).toEqual(['raffle', 'games']);
      expect(ids(g.earlier)).toEqual(['doors', 'skipped']);
    });

    it('before the day starts, everything after the first item is later', () => {
      const g = groupSchedule([item('a', '16:30'), item('b', '17:00'), item('c', '18:00')]);
      expect([ids(g.now), ids(g.next), ids(g.later), ids(g.earlier)]).toEqual([[], ['a'], ['b', 'c'], []]);
    });

    it('when the day is over, everything is earlier', () => {
      const g = groupSchedule([item('a', '16:30', 'done'), item('b', '17:00', 'cancelled')]);
      expect([ids(g.now), ids(g.next), ids(g.later), ids(g.earlier)]).toEqual([[], [], [], ['a', 'b']]);
    });
  });
});

describe('schedule store (file + SQLite)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'schedule-test-'));
  const file = path.join(dir, 'schedule.json');
  let store: typeof import('@/lib/scheduleStore');
  let bump = 0;

  /** Writes the file with a new mtime, so the store notices the change. */
  function writeSchedule(text: string) {
    writeFileSync(file, text);
    const t = new Date(Date.now() + ++bump * 1000);
    utimesSync(file, t, t);
  }
  const get = (id: string) => store.getScheduleWithStatus().items.find((i) => i.id === id)!;

  beforeAll(async () => {
    process.env.DB_PATH = path.join(dir, 'checkin.db');
    process.env.SCHEDULE_JSON = file;
    writeSchedule(
      items([
        { id: 'doors', title: 'Doors', start: '16:30' },
        { id: 'welcome', title: 'Welcome', start: '17:15' },
        { id: 'dinner', title: 'Dinner', start: '19:00' },
      ]),
    );
    store = await import('@/lib/scheduleStore');
  });

  afterAll(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {} // Windows may keep the WAL files locked until the process exits
  });

  it('starts every item as upcoming', () => {
    expect(store.getScheduleWithStatus().items.map((i) => i.status)).toEqual(['upcoming', 'upcoming', 'upcoming']);
  });

  it('records when an item actually started and finished', () => {
    store.setStatus('doors', 'starting', 'Admin');
    const started = get('doors').startedAt;
    expect(started).toBeTruthy();

    store.setStatus('doors', 'live', 'Admin');
    expect(get('doors')).toMatchObject({ status: 'live', startedAt: started, completedAt: null });

    store.setStatus('doors', 'done', 'Admin');
    const finished = get('doors').completedAt;
    expect(finished).toBeTruthy();
    store.setStatus('doors', 'done', 'Admin');
    expect(get('doors')).toMatchObject({ startedAt: started, completedAt: finished });
  });

  it('going back to upcoming clears the times', () => {
    store.setStatus('doors', 'upcoming', 'Admin');
    expect(get('doors')).toMatchObject({ status: 'upcoming', startedAt: null, completedAt: null });
  });

  it('keeps a note through status changes, and clears it when emptied', () => {
    store.setNote('welcome', '  Moved   to Hall B ', 'Admin');
    store.setStatus('welcome', 'live', 'Admin');
    expect(get('welcome')).toMatchObject({ status: 'live', note: 'Moved to Hall B' });
    store.setNote('welcome', '   ', 'Admin');
    expect(get('welcome').note).toBeNull();
  });

  it('completes an item and starts the next upcoming one', () => {
    expect(store.completeAndStartNext('welcome', 'Admin')).toBe('dinner');
    expect(get('welcome').status).toBe('done');
    expect(get('dinner')).toMatchObject({ status: 'starting' });
    expect(get('dinner').startedAt).toBeTruthy();
  });

  it('on the last item, just completes it', () => {
    expect(store.completeAndStartNext('dinner', 'Admin')).toBeNull();
    expect(get('dinner').status).toBe('done');
  });

  it('picks up edits to the file, and keeps the last good version if an edit is broken', () => {
    writeSchedule(items([{ id: 'doors', title: 'Doors open', start: '16:00' }, { id: 'dinner', title: 'Dinner', start: '19:00' }]));
    let result = store.getScheduleWithStatus();
    expect(result.error).toBeNull();
    expect(result.items.map((i) => i.title)).toEqual(['Doors open', 'Dinner']);
    expect(result.items[1].status).toBe('done'); // status follows the id

    writeSchedule('{ "items": [ { "id": "oops" ');
    result = store.getScheduleWithStatus();
    expect(result.error).toMatch(/not valid JSON/);
    expect(result.items.map((i) => i.title)).toEqual(['Doors open', 'Dinner']);
  });
});

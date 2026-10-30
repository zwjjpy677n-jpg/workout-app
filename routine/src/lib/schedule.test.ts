import { fromDateKey } from '../../../src/lib/dates';
import { applyValue, itemsForDay } from './schedule';
import type { Item, Log } from './types';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const at = (date: string, h = 0) => fromDateKey(date).getTime() + h * 3_600_000;
const item = (p: Partial<Item> & { id: string }): Item => ({
  name: p.id, slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: at('2026-01-01'), ...p,
});
const log = (date: string, itemId: string, done = true): Log => ({ id: `${date}:${itemId}`, date, itemId, done });
const TODAY = '2026-10-30';
const ids = (xs: Item[]) => xs.map((x) => x.id);

describe('itemsForDay', () => {
  test('曜日が合う日だけ出る', () => {
    const xs = [item({ id: 'a', days: [1, 3, 5] })];
    expect(ids(itemsForDay(xs, '2026-10-30', [], TODAY))).toEqual(['a']);
    expect(ids(itemsForDay(xs, '2026-10-31', [], TODAY))).toEqual([]);
  });

  test('作った日より前には出ない', () => {
    const xs = [item({ id: 'a', createdAt: at('2026-10-30', 12) })];
    expect(ids(itemsForDay(xs, '2026-10-29', [], TODAY))).toEqual([]);
    expect(ids(itemsForDay(xs, '2026-10-30', [], TODAY))).toEqual(['a']);
  });

  test('消した日とそれ以降には出ない', () => {
    const xs = [item({ id: 'a', deletedAt: at('2026-10-30', 12) })];
    expect(ids(itemsForDay(xs, '2026-10-29', [], '2026-10-31'))).toEqual(['a']);
    expect(ids(itemsForDay(xs, '2026-10-30', [], '2026-10-31'))).toEqual([]);
    expect(ids(itemsForDay(xs, '2026-10-31', [], '2026-10-31'))).toEqual([]);
  });

  test('休止中は今日は出ず、過去の日は記録があるときだけ出る', () => {
    const xs = [item({ id: 'a', active: false })];
    expect(ids(itemsForDay(xs, TODAY, [log(TODAY, 'a')], TODAY))).toEqual([]);
    expect(ids(itemsForDay(xs, '2026-10-29', [log('2026-10-29', 'a')], TODAY))).toEqual(['a']);
    expect(ids(itemsForDay(xs, '2026-10-29', [], TODAY))).toEqual([]);
  });

  test('時間帯の順、その中は order の順', () => {
    const xs = [
      item({ id: 'n0', slot: 'night', order: 0 }),
      item({ id: 'm1', slot: 'morning', order: 1 }),
      item({ id: 'm0', slot: 'morning', order: 0 }),
    ];
    expect(ids(itemsForDay(xs, TODAY, [], TODAY))).toEqual(['m0', 'm1', 'n0']);
  });
});

describe('applyValue', () => {
  const water = item({ id: 'w', kind: 'number', target: 1500, unit: 'ml', step: 250 });

  test('目標に届いたらできた', () => {
    expect(applyValue(water, 1500)).toEqual({ done: true, value: 1500 });
    expect(applyValue(water, 1499)).toEqual({ done: false, value: 1499 });
  });

  test('空にしたら値は消え、できていないに戻る', () => {
    const r = applyValue(water, null);
    expect(r).toEqual({ done: false });
    expect('value' in r).toBe(false);
  });

  test('チェック項目には done:false を返す', () => {
    expect(applyValue(item({ id: 'c' }), 5)).toEqual({ done: false });
  });
});

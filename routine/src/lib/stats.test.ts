import { fromDateKey } from '../../../src/lib/dates';
import { currentStreak, dayResult, itemRate, longestStreak, rangeRate, rateLevel } from './stats';
import type { Item, Log } from './types';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const at = (date: string) => fromDateKey(date).getTime();
const item = (p: Partial<Item> & { id: string }): Item => ({
  name: p.id, slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: at('2026-09-01'), ...p,
});
const log = (date: string, itemId: string, done = true): Log => ({ id: `${date}:${itemId}`, date, itemId, done });
const all = (dates: string[], ids: string[]) => dates.flatMap((d) => ids.map((i) => log(d, i)));
const ABC = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];

test('dayResult はできた数とやる数。やる項目0件の日は null', () => {
  expect(dayResult(ABC, [log('2026-10-30', 'a'), log('2026-10-30', 'b'), log('2026-10-30', 'c', false)], '2026-10-30', '2026-10-30'))
    .toEqual({ done: 2, total: 3 });
  expect(dayResult(ABC, [], '2026-08-01', '2026-10-30')).toBeNull();
});

describe('currentStreak', () => {
  const AB = [item({ id: 'a' }), item({ id: 'b' })];
  test('今日が未完了なら昨日から数える', () => {
    expect(currentStreak(AB, all(['2026-10-28', '2026-10-29'], ['a', 'b']), '2026-10-30')).toBe(2);
  });
  test('今日も全部できたら今日も数える', () => {
    expect(currentStreak(AB, all(['2026-10-28', '2026-10-29', '2026-10-30'], ['a', 'b']), '2026-10-30')).toBe(3);
  });
  test('昨日が未完了なら、今日が完了で1、未完了で0', () => {
    const logs = all(['2026-10-28'], ['a', 'b']);
    expect(currentStreak(AB, [...logs, ...all(['2026-10-30'], ['a', 'b'])], '2026-10-30')).toBe(1);
    expect(currentStreak(AB, logs, '2026-10-30')).toBe(0);
  });
  test('やる項目0件の日は途切れず、数えもしない', () => {
    // 2026-10-29 は木曜(4)。木曜を除いた項目
    const xs = [item({ id: 'a', days: [0, 1, 2, 3, 5, 6] })];
    expect(currentStreak(xs, all(['2026-10-28', '2026-10-30'], ['a']), '2026-10-30')).toBe(2);
  });
  test('項目も記録もなければ0', () => {
    expect(currentStreak([], [], '2026-10-30')).toBe(0);
    expect(currentStreak(AB, [], '2026-10-30')).toBe(0);
  });
  test('月をまたぐ', () => {
    expect(currentStreak(AB, all(['2026-09-30', '2026-10-01'], ['a', 'b']), '2026-10-01')).toBe(2);
  });
});

test('longestStreak はいちばん長く続いた日数', () => {
  const xs = [item({ id: 'a', createdAt: at('2026-10-01') })];
  const logs = all(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-07', '2026-10-08'], ['a']);
  expect(longestStreak(xs, logs, '2026-10-08')).toBe(5);
});

test('rangeRate は期間の合計で割る。分母0なら null', () => {
  const logs = [log('2026-10-29', 'a'), log('2026-10-29', 'b'), ...all(['2026-10-30'], ['a', 'b', 'c'])];
  expect(rangeRate(ABC, logs, '2026-10-29', '2026-10-30', '2026-10-30')).toBeCloseTo(5 / 6);
  expect(rangeRate(ABC, [], '2026-08-01', '2026-08-02', '2026-10-30')).toBeNull();
});

test('itemRate は消した項目でも、消す前の日の記録から出せる', () => {
  const gone = item({ id: 'a', createdAt: at('2026-10-27'), deletedAt: at('2026-10-29') + 3_600_000 });
  // 10-27, 10-28 が対象。10-27 だけできた
  expect(itemRate(gone, [log('2026-10-27', 'a')], '2026-10-01', '2026-10-30', '2026-10-30')).toBe(0.5);
  expect(dayResult([gone], [log('2026-10-27', 'a')], '2026-10-27', '2026-10-30')).toEqual({ done: 1, total: 1 });
});

test('rateLevel は3段階', () => {
  expect(rateLevel(0.49)).toBe(1);
  expect(rateLevel(0.5)).toBe(2);
  expect(rateLevel(0.99)).toBe(2);
  expect(rateLevel(1)).toBe(3);
});

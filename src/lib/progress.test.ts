import { entry, ex, set, wk } from '../test/factories';
import { bodyweightSeries, isPR, METRICS, personalBest, progressSeries, rangeStart } from './progress';

const bench = ex('bench');
const pullup = ex('pullup', { type: 'bodyweight' });
const now = new Date(2026, 9, 28, 12).getTime();
const DAY = 86_400_000;

const w1 = wk(now - 60 * DAY, [entry('bench', [set({ weight: 80, reps: 8 }), set({ weight: 200, reps: 1, warmup: true })])]);
const w2 = wk(now - 20 * DAY, [entry('bench', [set({ weight: 85, reps: 5 }), set({ weight: 60, reps: 10 })])]);
const w3 = wk(now - 2 * DAY, [entry('bench', [set({ weight: 90, reps: 3 })]), entry('pullup', [set({ weight: 10, reps: 8 }), set({ weight: 0, reps: 12 })])]);
const active = wk(now - DAY, [entry('bench', [set({ weight: 150, reps: 5 })])], { endedAt: null });
const all = [w3, active, w1, w2];

test('METRICS はタイプ別', () => {
  expect(METRICS.weight.map((m) => m.label)).toEqual(['推定1RM', '最大重量', 'ボリューム']);
  expect(METRICS.bodyweight.map((m) => m.label)).toEqual(['最大加重', '総回数']);
  expect(METRICS.time.map((m) => m.label)).toEqual(['最長時間', '合計時間']);
});

test('rangeStart', () => {
  expect(rangeStart('1M', now)).toBe(now - 30 * DAY);
  expect(rangeStart('ALL', now)).toBe(0);
});

test('progressSeries e1rm: 日付昇順、範囲外・ウォームアップ・進行中を除外', () => {
  const all3 = progressSeries(all, bench, 'e1rm', '3M', now);
  expect(all3.map((p) => p.date)).toEqual([w1.startedAt, w2.startedAt, w3.startedAt]);
  expect(all3[0].value).toBeCloseTo(101.33, 1);
  expect(progressSeries(all, bench, 'e1rm', '1M', now)).toHaveLength(2);
});

test('progressSeries の他指標', () => {
  expect(progressSeries(all, bench, 'maxWeight', 'ALL', now).map((p) => p.value)).toEqual([80, 85, 90]);
  expect(progressSeries(all, bench, 'volume', 'ALL', now).map((p) => p.value)).toEqual([640, 1025, 270]);
  expect(progressSeries(all, pullup, 'maxAdded', 'ALL', now).map((p) => p.value)).toEqual([10]);
  expect(progressSeries(all, pullup, 'totalReps', 'ALL', now).map((p) => p.value)).toEqual([20]);
});

test('bodyweightSeries', () => {
  const logs = [{ date: '2026-10-27', kg: 71 }, { date: '2026-06-01', kg: 70 }];
  expect(bodyweightSeries(logs, '1M', now)).toEqual([{ date: new Date(2026, 9, 27).getTime(), value: 71 }]);
  expect(bodyweightSeries(logs, 'ALL', now)).toHaveLength(2);
});

test('personalBest は全期間の完了ワークアウトのトップセット', () => {
  expect(personalBest(all, bench)?.set).toMatchObject({ weight: 80, reps: 8 });
  expect(personalBest(all, ex('none'))).toBeNull();
});

test('isPR: 初回はfalse、過去最高超えでtrue、同値はfalse', () => {
  expect(isPR(w1, bench, all)).toBe(false);
  const better = wk(now, [entry('bench', [set({ weight: 82.5, reps: 8 })])], { endedAt: null });
  expect(isPR(better, bench, all)).toBe(true);
  const same = wk(now, [entry('bench', [set({ weight: 80, reps: 8 })])], { endedAt: null });
  expect(isPR(same, bench, all)).toBe(false);
  const noSet = wk(now, [entry('bench', [set({ weight: 200, reps: 5, done: false })])], { endedAt: null });
  expect(isPR(noSet, bench, all)).toBe(false);
});

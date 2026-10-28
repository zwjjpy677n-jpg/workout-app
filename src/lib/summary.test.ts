import { entry, ex, exMap, set, wk } from '../test/factories';
import { monthSummary, previousEntry, volumeLevel, weekSummary, weeklySetsByBodyPart, workoutVolume } from './summary';

const bench = ex('bench');
const pullup = ex('pullup', { type: 'bodyweight', bodyPart: 'back' });
const plank = ex('plank', { type: 'time', bodyPart: 'core' });
const map = exMap(bench, pullup, plank);

test('previousEntry: 自分自身・それ以降・進行中・ワーキング無しを除外', () => {
  const A = wk(new Date(2026, 9, 1), [entry('bench', [set({ weight: 80, reps: 8 })])]);
  const B = wk(new Date(2026, 9, 5), [entry('bench', [set({ weight: 40, reps: 10, warmup: true })])]);
  const C = wk(new Date(2026, 9, 8), [entry('bench', [set({ weight: 85, reps: 5 })])]);
  const D = wk(new Date(2026, 9, 10), [entry('bench', [set({ weight: 90, reps: 3 })])]);
  const E = wk(new Date(2026, 9, 7), [entry('bench', [set({ weight: 99, reps: 1 })])], { endedAt: null });
  const all = [D, C, B, A, E];
  expect(previousEntry(all, 'bench', { startedAt: C.startedAt, id: C.id })?.workout.id).toBe(A.id);
  expect(previousEntry(all, 'bench', { startedAt: Date.now() })?.workout.id).toBe(D.id);
  expect(previousEntry(all, 'squat', { startedAt: Date.now() })).toBeNull();
});

test('workoutVolume / weekSummary はワーキングかつweightタイプのみ', () => {
  const w = wk(new Date(2026, 9, 27, 10), [
    entry('bench', [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5, warmup: true }), set({ weight: 100, reps: 5, done: false })]),
    entry('pullup', [set({ weight: 10, reps: 10 })]),
  ]);
  expect(workoutVolume(w, map)).toBe(500);
  const lastWeek = wk(new Date(2026, 9, 25, 10), [entry('bench', [set({ weight: 50, reps: 10 })])]);
  const active = wk(new Date(2026, 9, 28, 9), [entry('bench', [set({ weight: 50, reps: 10 })])], { endedAt: null });
  expect(weekSummary([w, lastWeek, active], map, new Date(2026, 9, 28, 12).getTime())).toEqual({ days: 1, volume: 500 });
});

test('weekSummary: 同じ日に2回は1日', () => {
  const a = wk(new Date(2026, 9, 27, 8), [entry('bench', [set({ weight: 10, reps: 10 })])]);
  const b = wk(new Date(2026, 9, 27, 18), [entry('bench', [set({ weight: 10, reps: 10 })])]);
  expect(weekSummary([a, b], map, new Date(2026, 9, 28).getTime())).toEqual({ days: 1, volume: 200 });
});

test('monthSummary: byDay はトレーニング日のみ、23:59開始は当日', () => {
  const a = wk(new Date(2026, 9, 3, 23, 59), [entry('bench', [set({ weight: 100, reps: 30 })])]);
  const b = wk(new Date(2026, 9, 25, 9), [entry('plank', [set({ durationSec: 60 })])]);
  const other = wk(new Date(2026, 10, 1, 9), [entry('bench', [set({ weight: 100, reps: 1 })])]);
  expect(monthSummary([a, b, other], map, 2026, 9)).toEqual({ days: 2, volume: 3000, byDay: { '2026-10-03': 3000, '2026-10-25': 0 } });
});

test('volumeLevel', () => {
  expect(volumeLevel(0, 1000)).toBe(1);
  expect(volumeLevel(330, 1000)).toBe(1);
  expect(volumeLevel(500, 1000)).toBe(2);
  expect(volumeLevel(1000, 1000)).toBe(3);
  expect(volumeLevel(0, 0)).toBe(1);
});

test('weeklySetsByBodyPart はtimeタイプとウォームアップを数えない', () => {
  const w = wk(new Date(2026, 9, 27), [
    entry('bench', [set({ weight: 1, reps: 1 }), set({ weight: 1, reps: 1 }), set({ weight: 1, reps: 1 }), set({ weight: 1, reps: 1, warmup: true })]),
    entry('pullup', [set({ reps: 5 }), set({ reps: 5 })]),
    entry('plank', [set({ durationSec: 60 }), set({ durationSec: 60 })]),
  ]);
  const r = weeklySetsByBodyPart([w], map, new Date(2026, 9, 28).getTime());
  expect(r).toEqual({ chest: 3, back: 2, shoulders: 0, arms: 0, legs: 0, core: 0, other: 0 });
});

import { entry, ex, exMap, item, routine, set, wk } from '../test/factories';
import { buildRoutineEntries, entryComplete } from './routineEntries';

const squat = ex('squat', { bodyPart: 'legs', barKg: 20 });
const plank = ex('plank', { type: 'time', bodyPart: 'core' });
const old = ex('old', { archived: true });
const map = exMap(squat, plank, old);
const now = new Date(2026, 9, 28, 10).getTime();
const history = [
  wk(new Date(2026, 9, 26, 18), [{ ...entry('squat', [set({ weight: 80, reps: 5 }), set({ weight: 80, reps: 5 }), set({ weight: 80, reps: 5 })]), slowed: false }]),
];
const r = routine('LEG', [item('squat', { sets: 3, reps: '5', main: true }), item('plank', { reps: '左右30秒' }), item('old'), item('missing')]);

test('buildRoutineEntries: おすすめ値を実値で入れ target を写す', () => {
  const es = buildRoutineEntries({ routine: r, exercises: map, history, deload: false, at: now });
  expect(es.map((e) => e.exerciseId)).toEqual(['squat', 'plank']);
  expect(es[0].target).toEqual({ sets: 3, reps: '5', main: true, inc: 2.5, note: '', restSec: null });
  expect(es[0].sets).toHaveLength(3);
  expect(es[0].sets[0]).toMatchObject({ weight: 82.5, reps: 5, durationSec: null, done: false, warmup: false });
  expect(es[0].slowed).toBe(false);
});

test('buildRoutineEntries: 回復週はセット半分で同じ重さ', () => {
  const es = buildRoutineEntries({ routine: r, exercises: map, history, deload: true, at: now });
  expect(es[0].sets).toHaveLength(2);
  expect(es[0].sets[0].weight).toBe(80);
});

test('buildRoutineEntries: 時間種目は durationSec、前回なしの重量は空', () => {
  const es = buildRoutineEntries({ routine: r, exercises: map, history: [], deload: false, at: now });
  expect(es[1].sets[0]).toMatchObject({ durationSec: 30, reps: null, weight: null });
  expect(es[0].sets[0]).toMatchObject({ weight: null, reps: 5 });
});

test('buildRoutineEntries: 前回の slowed を見る', () => {
  const h = [{ ...history[0], entries: [{ ...history[0].entries[0], slowed: true }] }];
  expect(buildRoutineEntries({ routine: r, exercises: map, history: h, deload: false, at: now })[0].sets[0].weight).toBe(80);
});

test('entryComplete', () => {
  expect(entryComplete(entry('a', [set({ warmup: true, done: false }), set()]))).toBe(true);
  expect(entryComplete(entry('a', [set(), set({ done: false })]))).toBe(false);
  expect(entryComplete(entry('a', [set({ warmup: true })]))).toBe(false);
  expect(entryComplete(entry('a', []))).toBe(false);
});

test('buildRoutineEntries: メニューのレストを target に写す', () => {
  const rr = routine('LEG', [item('squat', { restSec: 45 })]);
  expect(buildRoutineEntries({ routine: rr, exercises: map, history, deload: false, at: now })[0].target?.restSec).toBe(45);
});

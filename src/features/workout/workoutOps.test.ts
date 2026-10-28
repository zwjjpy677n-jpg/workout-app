import { emptySet } from '../../lib/types';
import { set } from '../../test/factories';
import { addSet, completeSet, placeholderFor, removeSet, toggleWarmup, updateSet, workingNumber } from './workoutOps';

test('workingNumber はウォームアップを飛ばす', () => {
  const sets = [set({ warmup: true }), set(), set()];
  expect(sets.map((_, i) => workingNumber(sets, i))).toEqual([null, 1, 2]);
});

test('placeholderFor は前回の同じ番号のワーキングセット', () => {
  const prev = { exerciseId: 'b', sets: [set({ weight: 40, warmup: true }), set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 7 }), set({ weight: 99, done: false })] };
  const cur = [set({ warmup: true, done: false }), set({ done: false }), set({ done: false }), set({ done: false })];
  expect(placeholderFor(prev, cur, 0)).toBeNull();
  expect(placeholderFor(prev, cur, 1)).toMatchObject({ weight: 80, reps: 8 });
  expect(placeholderFor(prev, cur, 2)).toMatchObject({ weight: 80, reps: 7 });
  expect(placeholderFor(prev, cur, 3)).toBeNull();
  expect(placeholderFor(null, cur, 1)).toBeNull();
});

test('completeSet は空欄をプレースホルダーで埋め、再タップで未完了に戻す', () => {
  const r = completeSet([{ ...emptySet(), reps: 6 }], 0, { ...emptySet(), weight: 80, reps: 8 });
  expect(r[0]).toMatchObject({ weight: 80, reps: 6, done: true });
  expect(completeSet(r, 0, null)[0]).toMatchObject({ weight: 80, reps: 6, done: false });
});

test('addSet は直前をコピーし done=false・メモ空', () => {
  const r = addSet([set({ weight: 80, reps: 8, rpe: 8, note: 'x', warmup: true })]);
  expect(r).toHaveLength(2);
  expect(r[1]).toEqual({ ...emptySet(), weight: 80, reps: 8, rpe: 8, warmup: true });
  expect(addSet([])).toEqual([emptySet()]);
});

test('toggleWarmup / updateSet / removeSet は不変更新', () => {
  const orig = [set(), set()];
  expect(toggleWarmup(orig, 0)[0].warmup).toBe(true);
  expect(updateSet(orig, 1, { reps: 3 })[1].reps).toBe(3);
  expect(removeSet(orig, 0)).toHaveLength(1);
  expect(orig[0].warmup).toBe(false);
  expect(orig).toHaveLength(2);
});

import { describe, expect, it } from 'vitest';
import { emptyCondition, type Exercise, type Workout, type WorkoutSet } from '../types';
import { friendPrs, fromSharedRows, toSharedWorkout, workoutMinutes } from './sharedWorkout';
import type { SharedWorkoutRow } from './types';

const set = (weight: number | null, reps: number | null, o: Partial<WorkoutSet> = {}): WorkoutSet => ({
  weight, reps, durationSec: null, rpe: null, warmup: false, note: '', done: true, ...o,
});
const ex = (id: string, name = 'ベンチプレス', o: Partial<Exercise> = {}): Exercise => ({
  id, name, bodyPart: 'chest', type: 'weight', restSec: 90, archived: false, createdAt: 0, barKg: null, ...o,
});
const wo = (o: Partial<Workout> = {}): Workout => ({
  id: 'workout-0001', name: '胸の日', startedAt: 1000, endedAt: 5000, note: 'ひみつ',
  condition: { ...emptyCondition() }, routineId: null,
  entries: [{ exerciseId: 'abcdefgh-1234', sets: [set(60, 10)] }], ...o,
});
const exMap = (...es: Exercise[]) => new Map(es.map((e) => [e.id, e]));

describe('toSharedWorkout', () => {
  it('ウォームアップと未完了のセットは送らない', () => {
    const w = wo({ entries: [{ exerciseId: 'abcdefgh-1234', sets: [set(20, 10, { warmup: true }), set(60, 8, { done: false }), set(60, 10)] }] });
    const s = toSharedWorkout(w, exMap(ex('abcdefgh-1234')))!;
    expect(s.body.e[0][4]).toEqual([[60, 10, null, null]]);
    expect(s.body.e[0][0]).toBe('abcdefgh');
  });
  it('終わっていない・完了セットが無いときは null', () => {
    const m = exMap(ex('abcdefgh-1234'));
    expect(toSharedWorkout(wo({ endedAt: null }), m)).toBeNull();
    expect(toSharedWorkout(wo({ entries: [{ exerciseId: 'abcdefgh-1234', sets: [set(60, 10, { done: false })] }] }), m)).toBeNull();
  });
  it('メモ・コンディションは送らない', () => {
    const s = toSharedWorkout(wo(), exMap(ex('abcdefgh-1234')))!;
    expect(Object.keys(s).sort()).toEqual(['body', 'endedAt', 'id', 'name', 'startedAt']);
    expect(JSON.stringify(s)).not.toContain('ひみつ');
  });
  it('開始と終了を送る', () => {
    const s = toSharedWorkout(wo({ startedAt: 1234, endedAt: 98765 }), exMap(ex('abcdefgh-1234')))!;
    expect(s.startedAt).toBe(1234);
    expect(s.endedAt).toBe(98765);
    expect(s.id).toBe('workout-0001');
  });
  it('上限で切る', () => {
    const exs = Array.from({ length: 60 }, (_, i) => ex(`id${String(i).padStart(6, '0')}-x`, 'あ'.repeat(60)));
    const w = wo({
      name: 'い'.repeat(60),
      entries: exs.map((e) => ({ exerciseId: e.id, sets: Array.from({ length: 60 }, () => set(10, 5)) })),
    });
    const s = toSharedWorkout(w, exMap(...exs))!;
    expect(s.name).toHaveLength(40);
    expect(s.body.e).toHaveLength(50);
    expect(s.body.e[0][1]).toHaveLength(40);
    expect(s.body.e[0][4]).toHaveLength(50);
  });
});

const row = (o: Partial<SharedWorkoutRow> = {}): SharedWorkoutRow => ({
  id: 'w1', name: '胸', startedAt: 1000, endedAt: 5000, userId: 'F', updatedAt: '', deleted: false,
  body: { e: [['abcdefgh', 'ベンチ', 0, 0, [[60, 10, null, null]]]] }, ...o,
});

describe('fromSharedRows', () => {
  it('戻すと友達の記録になる', () => {
    const { workouts, exercises } = fromSharedRows('F', [
      row(),
      row({ id: 'w2', startedAt: 9000, endedAt: 9500 }),
    ]);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]).toMatchObject({ id: 'F:abcdefgh', name: 'ベンチ', type: 'weight', restSec: 0, archived: false, barKg: null });
    expect(workouts.map((w) => w.id)).toEqual(['F:w1', 'F:w2']);
    expect(workouts[0]).toMatchObject({ friendId: 'F', endedAt: 5000, startedAt: 1000, note: '', routineId: null });
    expect(workouts[0].entries[0].exerciseId).toBe('F:abcdefgh');
    expect(workouts[0].entries[0].sets[0]).toMatchObject({ weight: 60, reps: 10, done: true, warmup: false });
  });
  it('削除済みは無視し、同じ x8 は最新の名前を使う', () => {
    const { workouts, exercises } = fromSharedRows('F', [
      row({ id: 'w2', startedAt: 9000, body: { e: [['abcdefgh', '新名', 0, 0, [[1, 1, null, null]]]] } }),
      row({ id: 'w1', startedAt: 1000 }),
      row({ id: 'w3', startedAt: 20000, deleted: true }),
    ]);
    expect(workouts.map((w) => w.id)).toEqual(['F:w1', 'F:w2']);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe('新名');
  });
});

describe('workoutMinutes', () => {
  it('ワークアウト時間', () => {
    expect(workoutMinutes({ startedAt: 0, endedAt: 62 * 60000 + 20000 })).toBe(62);
    expect(workoutMinutes({ startedAt: 5, endedAt: 5 })).toBeNull();
    expect(workoutMinutes({ startedAt: 5, endedAt: null })).toBeNull();
  });
});

describe('friendPrs', () => {
  it('自己ベスト', () => {
    const { workouts, exercises } = fromSharedRows('F', [
      row(),
      row({ id: 'w2', startedAt: 2000, body: { e: [['abcdefgh', 'ベンチ', 0, 0, [[80, 5, null, null]]]] } }),
    ]);
    const prs = friendPrs(exercises, workouts);
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseId).toBe('F:abcdefgh');
    expect(prs[0].set.weight).toBe(80);
  });
});

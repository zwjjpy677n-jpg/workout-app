import { emptySet, type WorkoutSet } from './types';
import { estimate1RM, formatDuration, formatKg, formatSet, formatVolume, isWorking, setVolume, topSet, volumeParts } from './calc';

const s = (o: Partial<WorkoutSet>): WorkoutSet => ({ ...emptySet(), done: true, ...o });

test('estimate1RM', () => {
  expect(estimate1RM(100, 1)).toBe(100);
  expect(estimate1RM(80, 8)).toBeCloseTo(101.333, 2);
  expect(estimate1RM(80, 0)).toBe(0);
  expect(estimate1RM(null, 5)).toBe(0);
});

test('ウォームアップと未完了はワーキングでない', () => {
  expect(isWorking({ ...emptySet(), done: true })).toBe(true);
  expect(isWorking({ ...emptySet(), done: true, warmup: true })).toBe(false);
  expect(isWorking({ ...emptySet(), done: false })).toBe(false);
});

test('setVolume は weight×reps、未入力は0', () => {
  expect(setVolume(s({ weight: 100, reps: 5 }))).toBe(500);
  expect(setVolume(s({ weight: 100, reps: null }))).toBe(0);
});

test('topSet: weightは推定1RM、bodyweightは加重→回数、timeは秒', () => {
  expect(topSet('weight', [s({ weight: 100, reps: 1 }), s({ weight: 80, reps: 10 })])?.weight).toBe(80);
  expect(topSet('weight', [s({ weight: 200, reps: 1, warmup: true }), s({ weight: 60, reps: 5 })])?.weight).toBe(60);
  expect(topSet('bodyweight', [s({ weight: 10, reps: 5 }), s({ weight: 10, reps: 8 }), s({ weight: 0, reps: 20 })])?.reps).toBe(8);
  expect(topSet('time', [s({ durationSec: 60 }), s({ durationSec: 95 })])?.durationSec).toBe(95);
  expect(topSet('weight', [])).toBeNull();
  expect(topSet('weight', [s({ weight: 100, reps: 5, done: false })])).toBeNull();
});

test('formatKg / formatDuration', () => {
  expect(formatKg(82.5)).toBe('82.5');
  expect(formatKg(80)).toBe('80');
  expect(formatKg(0.1 + 0.2)).toBe('0.3');
  expect(formatDuration(90)).toBe('1:30');
  expect(formatDuration(3725)).toBe('1:02:05');
  expect(formatDuration(5)).toBe('0:05');
});

test('formatSet', () => {
  const u = (o: Partial<WorkoutSet>) => ({ ...emptySet(), ...o });
  expect(formatSet('weight', u({ weight: 80, reps: 8, rpe: 8 }))).toBe('80kg × 8 @RPE8');
  expect(formatSet('weight', u({ weight: 0.1 + 0.2 + 82.2, reps: 5 }))).toBe('82.5kg × 5');
  expect(formatSet('bodyweight', u({ weight: 10, reps: 12 }))).toBe('自重+10kg × 12');
  expect(formatSet('bodyweight', u({ weight: -15, reps: 6 }))).toBe('自重-15kg × 6');
  expect(formatSet('bodyweight', u({ weight: null, reps: 15 }))).toBe('自重 × 15');
  expect(formatSet('time', u({ durationSec: 90, rpe: 7.5 }))).toBe('1:30 @RPE7.5');
});

test('formatVolume は1000kg未満はkg、以上はt', () => {
  expect(formatVolume(850)).toBe('850kg');
  expect(formatVolume(1500)).toBe('1.5t');
  expect(formatVolume(4000)).toBe('4.0t');
  expect(volumeParts(18420)).toEqual({ value: '18.4', unit: 't' });
  expect(volumeParts(0)).toEqual({ value: '0', unit: 'kg' });
});

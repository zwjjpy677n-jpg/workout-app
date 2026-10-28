import { isWorking } from '../../lib/calc';
import { emptySet, type ExerciseType, type WorkoutEntry, type WorkoutSet } from '../../lib/types';

/** ウォームアップは null、それ以外は 1 始まりの通し番号 */
export function workingNumber(sets: WorkoutSet[], index: number): number | null {
  if (sets[index]?.warmup) return null;
  return sets.slice(0, index + 1).filter((s) => !s.warmup).length;
}

export function placeholderFor(prev: WorkoutEntry | null, sets: WorkoutSet[], index: number): WorkoutSet | null {
  const n = workingNumber(sets, index);
  if (!prev || n == null) return null;
  return prev.sets.filter(isWorking)[n - 1] ?? null;
}

export function addSet(sets: WorkoutSet[]): WorkoutSet[] {
  const last = sets.at(-1);
  if (!last) return [emptySet()];
  return [...sets, { ...emptySet(), weight: last.weight, reps: last.reps, durationSec: last.durationSec, rpe: last.rpe, warmup: last.warmup }];
}

export function updateSet(sets: WorkoutSet[], index: number, patch: Partial<WorkoutSet>): WorkoutSet[] {
  return sets.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

export function toggleWarmup(sets: WorkoutSet[], index: number): WorkoutSet[] {
  return updateSet(sets, index, { warmup: !sets[index].warmup });
}

export function removeSet(sets: WorkoutSet[], index: number): WorkoutSet[] {
  return sets.filter((_, i) => i !== index);
}

/** 完了を切り替える。完了時は空欄をプレースホルダーで埋め、必須値が揃わなければ何もしない */
export function completeSet(type: ExerciseType, sets: WorkoutSet[], index: number, placeholder: WorkoutSet | null): WorkoutSet[] {
  const s = sets[index];
  if (s.done) return updateSet(sets, index, { done: false });
  const filled = {
    weight: s.weight ?? placeholder?.weight ?? null,
    reps: s.reps ?? placeholder?.reps ?? null,
    durationSec: s.durationSec ?? placeholder?.durationSec ?? null,
  };
  const ready =
    type === 'weight' ? filled.weight != null && filled.reps != null : type === 'bodyweight' ? filled.reps != null : filled.durationSec != null;
  if (!ready) return sets;
  return updateSet(sets, index, { done: true, ...filled });
}

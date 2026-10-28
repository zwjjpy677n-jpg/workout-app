import type { ExerciseType, WorkoutSet } from './types';

export function estimate1RM(weight: number | null, reps: number | null): number {
  if (weight == null || reps == null || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function isWorking(set: WorkoutSet): boolean {
  return set.done && !set.warmup;
}

export function setVolume(set: WorkoutSet): number {
  return (set.weight ?? 0) * (set.reps ?? 0);
}

/** a が良ければ正 */
export function compareSets(type: ExerciseType, a: WorkoutSet, b: WorkoutSet): number {
  switch (type) {
    case 'weight':
      return estimate1RM(a.weight, a.reps) - estimate1RM(b.weight, b.reps);
    case 'bodyweight':
      return (a.weight ?? 0) - (b.weight ?? 0) || (a.reps ?? 0) - (b.reps ?? 0);
    case 'time':
      return (a.durationSec ?? 0) - (b.durationSec ?? 0);
  }
}

export function topSet(type: ExerciseType, sets: WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const set of sets) {
    if (!isWorking(set)) continue;
    if (!best || compareSets(type, set, best) > 0) best = set;
  }
  return best;
}

export function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(Math.floor(sec % 60)).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function rpeSuffix(set: WorkoutSet): string {
  return set.rpe != null ? ` @RPE${set.rpe}` : '';
}

export function formatSet(type: ExerciseType, set: WorkoutSet): string {
  switch (type) {
    case 'weight':
      return `${formatKg(set.weight ?? 0)}kg × ${set.reps ?? 0}${rpeSuffix(set)}`;
    case 'bodyweight': {
      const w = set.weight ?? 0;
      const load = w > 0 ? `+${formatKg(w)}kg` : w < 0 ? `-${formatKg(-w)}kg` : '';
      return `自重${load} × ${set.reps ?? 0}${rpeSuffix(set)}`;
    }
    case 'time':
      return `${formatDuration(set.durationSec ?? 0)}${rpeSuffix(set)}`;
  }
}

export function volumeParts(kg: number): { value: string; unit: 'kg' | 't' } {
  return kg < 1000 ? { value: String(Math.round(kg)), unit: 'kg' } : { value: (kg / 1000).toFixed(1), unit: 't' };
}

export function formatVolume(kg: number): string {
  const p = volumeParts(kg);
  return p.value + p.unit;
}

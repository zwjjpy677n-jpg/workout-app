import { formatDuration, formatSet, isWorking } from '../../lib/calc';
import type { ExerciseType, WorkoutSet } from '../../lib/types';

/** ワーキングセットを要約: 同じ重量が続く間は回数だけを並べる（80kg × 8 / 8 / 85kg × 5） */
export function summarizeSets(type: ExerciseType, sets: WorkoutSet[]): string {
  const working = sets.filter(isWorking);
  if (type === 'time') return working.map((s) => formatDuration(s.durationSec ?? 0)).join(' / ');
  const parts: string[] = [];
  let load: number | null | undefined;
  for (const s of working) {
    parts.push(s.weight === load ? String(s.reps ?? 0) : formatSet(type, { ...s, rpe: null }));
    load = s.weight;
  }
  return parts.join(' / ');
}

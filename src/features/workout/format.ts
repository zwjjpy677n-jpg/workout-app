import { formatDuration, formatKg } from '../../lib/calc';
import type { ExerciseType, WorkoutSet } from '../../lib/types';

/** 前回列用の短い表記: 80×8 / 自重×10 / +10×12 / BW×15 / 1:30 */
export function shortSet(type: ExerciseType, s: WorkoutSet): string {
  if (type === 'time') return formatDuration(s.durationSec ?? 0);
  const w = s.weight ?? 0;
  if (type === 'bodyweight') return `${w > 0 ? '+' : ''}${w === 0 ? 'BW' : formatKg(w)}×${s.reps ?? 0}`;
  return `${s.weight === 0 ? '自重' : formatKg(w)}×${s.reps ?? 0}`;
}

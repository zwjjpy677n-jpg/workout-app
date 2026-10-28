import { compareSets, estimate1RM, isWorking, setVolume, topSet } from './calc';
import { DAY, fromDateKey } from './dates';
import { completed } from './summary';
import type { BodyweightLog, Exercise, ExerciseType, Workout, WorkoutSet } from './types';

export type Range = '1M' | '3M' | '1Y' | 'ALL';
export type Metric = 'e1rm' | 'maxWeight' | 'volume' | 'maxAdded' | 'totalReps' | 'maxTime' | 'totalTime';
export type Point = { date: number; value: number };

export const RANGES: Range[] = ['1M', '3M', '1Y', 'ALL'];

export const METRICS: Record<ExerciseType, { key: Metric; label: string }[]> = {
  weight: [
    { key: 'e1rm', label: '推定1RM' },
    { key: 'maxWeight', label: '最大重量' },
    { key: 'volume', label: 'ボリューム' },
  ],
  bodyweight: [
    { key: 'maxAdded', label: '最大加重' },
    { key: 'totalReps', label: '総回数' },
  ],
  time: [
    { key: 'maxTime', label: '最長時間' },
    { key: 'totalTime', label: '合計時間' },
  ],
};

const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '1Y': 365, ALL: 0 };

export function rangeStart(range: Range, now: number): number {
  return range === 'ALL' ? 0 : now - RANGE_DAYS[range] * DAY;
}

const max = (xs: number[]) => Math.max(...xs);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function metricValue(metric: Metric, sets: WorkoutSet[]): number {
  switch (metric) {
    case 'e1rm': return max(sets.map((s) => estimate1RM(s.weight, s.reps)));
    case 'maxWeight': return max(sets.map((s) => s.weight ?? 0));
    case 'volume': return sum(sets.map(setVolume));
    case 'maxAdded': return max(sets.map((s) => s.weight ?? 0));
    case 'totalReps': return sum(sets.map((s) => s.reps ?? 0));
    case 'maxTime': return max(sets.map((s) => s.durationSec ?? 0));
    case 'totalTime': return sum(sets.map((s) => s.durationSec ?? 0));
  }
}

function workingSets(w: Workout, exerciseId: string): WorkoutSet[] {
  return w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(isWorking));
}

export function progressSeries(workouts: Workout[], exercise: Exercise, metric: Metric, range: Range, now: number): Point[] {
  const from = rangeStart(range, now);
  return completed(workouts)
    .filter((w) => w.startedAt >= from)
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((w) => {
      const sets = workingSets(w, exercise.id);
      return sets.length ? [{ date: w.startedAt, value: metricValue(metric, sets) }] : [];
    });
}

export function bodyfatSeries(logs: BodyweightLog[], range: Range, now: number): Point[] {
  const from = rangeStart(range, now);
  return logs
    .filter((l): l is BodyweightLog & { fatPct: number } => l.fatPct != null)
    .map((l) => ({ date: fromDateKey(l.date).getTime(), value: l.fatPct }))
    .filter((p) => p.date >= from)
    .sort((a, b) => a.date - b.date);
}

export function bodyweightSeries(logs: BodyweightLog[], range: Range, now: number): Point[] {
  const from = rangeStart(range, now);
  return logs
    .map((l) => ({ date: fromDateKey(l.date).getTime(), value: l.kg }))
    .filter((p) => p.date >= from)
    .sort((a, b) => a.date - b.date);
}

export function personalBest(workouts: Workout[], exercise: Exercise): { set: WorkoutSet; workout: Workout } | null {
  let best: { set: WorkoutSet; workout: Workout } | null = null;
  for (const w of completed(workouts)) {
    const t = topSet(exercise.type, workingSets(w, exercise.id));
    if (t && (!best || compareSets(exercise.type, t, best.set) > 0)) best = { set: t, workout: w };
  }
  return best;
}

export function isPR(workout: Workout, exercise: Exercise, history: Workout[]): boolean {
  const mine = topSet(exercise.type, workingSets(workout, exercise.id));
  if (!mine) return false;
  const past = history.filter((w) => w.id !== workout.id && w.startedAt < workout.startedAt);
  const best = personalBest(past, exercise);
  return !!best && compareSets(exercise.type, mine, best.set) > 0;
}

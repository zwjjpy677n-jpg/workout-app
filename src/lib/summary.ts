import { isWorking, setVolume } from './calc';
import { endOfWeek, startOfWeek, toDateKey } from './dates';
import { BODY_PARTS, type BodyPart, type Exercise, type Workout, type WorkoutEntry } from './types';

export const completed = (workouts: Workout[]) => workouts.filter((w) => w.endedAt !== null);

const hasWorking = (e: WorkoutEntry) => e.sets.some(isWorking);

export function previousEntry(
  workouts: Workout[],
  exerciseId: string,
  before: { startedAt: number; id?: string },
): { workout: Workout; entry: WorkoutEntry } | null {
  let best: { workout: Workout; entry: WorkoutEntry } | null = null;
  for (const w of completed(workouts)) {
    if (w.id === before.id || w.startedAt >= before.startedAt) continue;
    if (best && w.startedAt <= best.workout.startedAt) continue;
    const e = w.entries.find((x) => x.exerciseId === exerciseId && hasWorking(x));
    if (e) best = { workout: w, entry: e };
  }
  return best;
}

export function workoutVolume(workout: Workout, exercises: Map<string, Exercise>): number {
  let v = 0;
  for (const e of workout.entries) {
    if (exercises.get(e.exerciseId)?.type !== 'weight') continue;
    for (const s of e.sets) if (isWorking(s)) v += setVolume(s);
  }
  return v;
}

function summarize(list: Workout[], exercises: Map<string, Exercise>) {
  const byDay: Record<string, number> = {};
  for (const w of list) {
    const k = toDateKey(w.startedAt);
    byDay[k] = (byDay[k] ?? 0) + workoutVolume(w, exercises);
  }
  const volume = Object.values(byDay).reduce((a, b) => a + b, 0);
  return { days: Object.keys(byDay).length, volume, byDay };
}

function inWeek(workouts: Workout[], now: number) {
  const from = startOfWeek(now);
  const to = endOfWeek(now);
  return completed(workouts).filter((w) => w.startedAt >= from && w.startedAt < to);
}

export function weekSummary(workouts: Workout[], exercises: Map<string, Exercise>, now: number): { days: number; volume: number } {
  const { days, volume } = summarize(inWeek(workouts, now), exercises);
  return { days, volume };
}

export function monthSummary(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  year: number,
  month0: number,
): { days: number; volume: number; byDay: Record<string, number> } {
  const list = completed(workouts).filter((w) => {
    const d = new Date(w.startedAt);
    return d.getFullYear() === year && d.getMonth() === month0;
  });
  return summarize(list, exercises);
}

export function volumeLevel(volume: number, maxVolume: number): 1 | 2 | 3 {
  if (maxVolume <= 0) return 1;
  const r = volume / maxVolume;
  if (r <= 1 / 3) return 1;
  if (r <= 2 / 3) return 2;
  return 3;
}

export function weeklySetsByBodyPart(workouts: Workout[], exercises: Map<string, Exercise>, now: number): Record<BodyPart, number> {
  const r = Object.fromEntries(BODY_PARTS.map((b) => [b, 0])) as Record<BodyPart, number>;
  for (const w of inWeek(workouts, now)) {
    for (const e of w.entries) {
      const x = exercises.get(e.exerciseId);
      if (!x || x.type === 'time') continue;
      r[x.bodyPart] += e.sets.filter(isWorking).length;
    }
  }
  return r;
}

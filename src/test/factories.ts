import { defaultItem, emptyCondition, emptySet, type Exercise, type Routine, type RoutineItem, type Workout, type WorkoutEntry, type WorkoutSet } from '../lib/types';

let n = 0;

export function ex(id: string, o: Partial<Exercise> = {}): Exercise {
  return { id, name: id, bodyPart: 'chest', type: 'weight', restSec: 90, archived: false, createdAt: 0, barKg: null, ...o };
}

export function set(o: Partial<WorkoutSet> = {}): WorkoutSet {
  return { ...emptySet(), done: true, ...o };
}

export function entry(exerciseId: string, sets: WorkoutSet[]): WorkoutEntry {
  return { exerciseId, sets };
}

export function wk(startedAt: number | Date, entries: WorkoutEntry[], o: Partial<Workout> = {}): Workout {
  const t = typeof startedAt === 'number' ? startedAt : startedAt.getTime();
  return { id: `w${++n}`, name: 'Workout', startedAt: t, endedAt: t + 3600_000, note: '', condition: emptyCondition(), entries, routineId: null, ...o };
}

export function exMap(...list: Exercise[]): Map<string, Exercise> {
  return new Map(list.map((e) => [e.id, e]));
}

export function item(exerciseId: string, o: Partial<RoutineItem> = {}): RoutineItem {
  return { ...defaultItem(exerciseId), ...o };
}

export function routine(name: string, items: RoutineItem[], o: Partial<Routine> = {}): Routine {
  return { id: `r${++n}`, name, weekday: null, items, createdAt: n, ...o };
}

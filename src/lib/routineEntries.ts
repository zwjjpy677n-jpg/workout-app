import { previousEntry } from './summary';
import { suggest } from './suggest';
import { emptySet, type Exercise, type Routine, type Workout, type WorkoutEntry } from './types';

/** ルーティンの各種目について、前回の結果からおすすめを計算して入力済みのエントリーを作る */
export function buildRoutineEntries(args: {
  routine: Routine;
  exercises: Map<string, Exercise>;
  history: Workout[];
  deload: boolean;
  at: number;
}): WorkoutEntry[] {
  const { routine, exercises, history, deload, at } = args;
  const entries: WorkoutEntry[] = [];
  for (const it of routine.items) {
    const ex = exercises.get(it.exerciseId);
    if (!ex || ex.archived) continue;
    const target = { sets: it.sets, reps: it.reps, main: it.main, inc: it.inc, note: it.note, restSec: it.restSec ?? null };
    const prev = previousEntry(history, ex.id, { startedAt: at });
    const sg = suggest({ target, type: ex.type, prev: prev && { sets: prev.entry.sets, slowed: !!prev.entry.slowed }, deload });
    const sets = Array.from({ length: sg.sets }, () => ({ ...emptySet(), weight: sg.weight, reps: sg.reps, durationSec: sg.durationSec }));
    entries.push({ exerciseId: ex.id, sets, target, slowed: false });
  }
  return entries;
}

/** ワーキングセットが1つ以上あり、すべて完了している */
export function entryComplete(entry: WorkoutEntry): boolean {
  const working = entry.sets.filter((s) => !s.warmup);
  return working.length > 0 && working.every((s) => s.done);
}

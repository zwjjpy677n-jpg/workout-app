import type { BackupData } from '../lib/backup';
import { toDateKey } from '../lib/dates';
import { programStatus } from '../lib/program';
import { buildRoutineEntries } from '../lib/routineEntries';
import { emptyCondition, emptySet, type BodyweightLog, type Exercise, type Program, type Routine, type RoutineItem, type Settings, type Workout } from '../lib/types';
import { db } from './db';
import { DEFAULT_SETTINGS } from './seed';

const uid = () => crypto.randomUUID();

let lastStamp = 0;
/** 作成順の並びが崩れないよう、同じミリ秒でも必ず増える作成時刻 */
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

// --- 種目 ---
export async function listExercises(opts: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all.filter((e) => opts.includeArchived || !e.archived).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addExercise(input: Omit<Exercise, 'id' | 'archived' | 'createdAt'>): Promise<Exercise> {
  const e: Exercise = { ...input, id: uid(), archived: false, createdAt: stamp() };
  await db.exercises.add(e);
  return e;
}

export async function isExerciseUsed(id: string): Promise<boolean> {
  const all = await db.workouts.toArray();
  return all.some((w) => w.entries.some((e) => e.exerciseId === id));
}

export async function updateExercise(id: string, patch: Partial<Omit<Exercise, 'id'>>): Promise<void> {
  const cur = await db.exercises.get(id);
  if (!cur) return;
  if (patch.type && patch.type !== cur.type && (await isExerciseUsed(id))) {
    throw new Error('記録済みの種目はタイプを変更できません');
  }
  await db.exercises.update(id, patch);
}

export async function removeExercise(id: string): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', db.exercises, db.workouts, db.routines, async () => {
    const routines = await db.routines.toArray();
    for (const r of routines) {
      if (r.items.some((i) => i.exerciseId === id)) await db.routines.update(r.id, { items: r.items.filter((i) => i.exerciseId !== id) });
    }
    if (await isExerciseUsed(id)) {
      await db.exercises.update(id, { archived: true });
      return 'archived';
    }
    await db.exercises.delete(id);
    return 'deleted';
  });
}

// --- ルーティン ---
export async function listRoutines(): Promise<Routine[]> {
  return (await db.routines.toArray()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveRoutine(r: {
  id?: string;
  name: string;
  weekday: number | null;
  items: RoutineItem[];
  createdAt?: number;
}): Promise<Routine> {
  const row: Routine = { id: r.id ?? uid(), name: r.name, weekday: r.weekday, items: r.items, createdAt: r.createdAt ?? stamp() };
  await db.routines.put(row);
  return row;
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.routines.delete(id);
}

// --- ワークアウト ---
export async function getActiveWorkout(): Promise<Workout | undefined> {
  return (await db.workouts.toArray()).find((w) => w.endedAt === null);
}

export async function startWorkout(opts: { name: string; exerciseIds: string[] }): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const active = await getActiveWorkout();
    if (active) return active;
    const w: Workout = {
      id: uid(),
      name: opts.name,
      startedAt: Date.now(),
      endedAt: null,
      note: '',
      condition: emptyCondition(),
      entries: opts.exerciseIds.map((exerciseId) => ({ exerciseId, sets: [emptySet()] })),
      routineId: null,
    };
    await db.workouts.add(w);
    return w;
  });
}

/** ルーティンからおすすめ入りのワークアウトを始める。進行中があればそれを返す */
export async function startRoutineWorkout(routineId: string, now: number = Date.now()): Promise<Workout> {
  return db.transaction('rw', [db.workouts, db.routines, db.exercises, db.settings], async () => {
    const active = await getActiveWorkout();
    if (active) return active;
    const routine = await db.routines.get(routineId);
    if (!routine) throw new Error('ルーティンが見つかりません');
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const deload = programStatus(await getProgram(), toDateKey(now)).deload;
    const w: Workout = {
      id: uid(),
      name: routine.name,
      startedAt: now,
      endedAt: null,
      note: '',
      condition: emptyCondition(),
      entries: buildRoutineEntries({ routine, exercises, history: await db.workouts.toArray(), deload, at: now }),
      routineId: routine.id,
    };
    await db.workouts.add(w);
    return w;
  });
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  return db.workouts.get(id);
}

export async function saveWorkout(w: Workout): Promise<void> {
  await db.workouts.put(w);
}

export async function finishWorkout(id: string, now: number = Date.now()): Promise<'saved' | 'empty'> {
  const w = await db.workouts.get(id);
  if (!w) return 'empty';
  const entries = w.entries.filter((e) => e.sets.some((s) => s.done));
  if (entries.length === 0) return 'empty';
  await db.workouts.put({ ...w, entries, endedAt: now });
  return 'saved';
}

/** 過去ワークアウトの編集を確定: 完了セットのない種目を除く（endedAt は維持）。完了セットが0なら変更せず 'empty' */
export async function saveEditedWorkout(id: string): Promise<'saved' | 'empty'> {
  const w = await db.workouts.get(id);
  if (!w) return 'empty';
  const entries = w.entries.filter((e) => e.sets.some((s) => s.done));
  if (entries.length === 0) return 'empty';
  await db.workouts.put({ ...w, entries });
  return 'saved';
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
}

export async function listWorkouts(): Promise<Workout[]> {
  return db.workouts.orderBy('startedAt').toArray();
}

// --- 体重 ---
export async function setBodyweight(date: string, kg: number): Promise<void> {
  await db.bodyweights.put({ date, kg });
}

export async function deleteBodyweight(date: string): Promise<void> {
  await db.bodyweights.delete(date);
}

export async function listBodyweights(): Promise<BodyweightLog[]> {
  return db.bodyweights.orderBy('date').toArray();
}

// --- 設定 ---
export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('app');
  return row?.key === 'app' ? { barKg: row.barKg, plates: row.plates } : { ...DEFAULT_SETTINGS, plates: [...DEFAULT_SETTINGS.plates] };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ key: 'app', barKg: s.barKg, plates: s.plates });
}

// --- プログラム ---
export async function getProgram(): Promise<Program | null> {
  const row = await db.settings.get('program');
  return row?.key === 'program' ? row.program : null;
}

export async function saveProgram(p: Program | null): Promise<void> {
  if (p) await db.settings.put({ key: 'program', program: p });
  else await db.settings.delete('program');
}

// --- バックアップ ---
export async function exportAll(now: number = Date.now()): Promise<BackupData> {
  return {
    app: 'ironlog',
    version: 2,
    exportedAt: now,
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    bodyweights: await db.bodyweights.toArray(),
    settings: await getSettings(),
    program: await getProgram(),
  };
}

export async function importAll(data: BackupData): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.exercises.bulkAdd(data.exercises);
    await db.routines.bulkAdd(data.routines);
    await db.workouts.bulkAdd(data.workouts);
    await db.bodyweights.bulkAdd(data.bodyweights);
    await db.settings.put({ key: 'app', ...data.settings });
    if (data.program) await db.settings.put({ key: 'program', program: data.program });
    await db.settings.put({ key: 'menuSeeded', at: Date.now() });
  });
}

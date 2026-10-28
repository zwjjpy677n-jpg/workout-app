import type { BackupData } from '../lib/backup';
import { emptyCondition, emptySet, type BodyweightLog, type Exercise, type Routine, type Settings, type Workout } from '../lib/types';
import { db } from './db';
import { DEFAULT_SETTINGS } from './seed';

const uid = () => crypto.randomUUID();

// --- 種目 ---
export async function listExercises(opts: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all.filter((e) => opts.includeArchived || !e.archived).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addExercise(input: Omit<Exercise, 'id' | 'archived' | 'createdAt'>): Promise<Exercise> {
  const e: Exercise = { ...input, id: uid(), archived: false, createdAt: Date.now() };
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
  if (await isExerciseUsed(id)) {
    await db.exercises.update(id, { archived: true });
    return 'archived';
  }
  await db.exercises.delete(id);
  return 'deleted';
}

// --- ルーティン ---
export async function listRoutines(): Promise<Routine[]> {
  return (await db.routines.toArray()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveRoutine(r: Omit<Routine, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<Routine> {
  const row: Routine = { id: r.id ?? uid(), name: r.name, exerciseIds: r.exerciseIds, createdAt: r.createdAt ?? Date.now() };
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
  return row ? { barKg: row.barKg, plates: row.plates } : { ...DEFAULT_SETTINGS, plates: [...DEFAULT_SETTINGS.plates] };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ key: 'app', barKg: s.barKg, plates: s.plates });
}

// --- バックアップ ---
export async function exportAll(now: number = Date.now()): Promise<BackupData> {
  return {
    app: 'ironlog',
    version: 1,
    exportedAt: now,
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    bodyweights: await db.bodyweights.toArray(),
    settings: await getSettings(),
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
  });
}

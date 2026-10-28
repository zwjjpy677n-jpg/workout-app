import { BODY_PARTS, defaultItem, type BodyweightLog, type Exercise, type Program, type Routine, type Settings, type Workout } from './types';

export interface BackupData {
  app: 'ironlog';
  version: 2;
  exportedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  bodyweights: BodyweightLog[];
  settings: Settings;
  program: Program | null;
}

// --- v1 → v2 変換（Dexie の upgrade でも使う） ---
const V1_BAR_KG: Record<string, number> = { ベンチプレス: 20, スクワット: 20, デッドリフト: 20 };

export function migrateExerciseV1<T extends { name: string }>(e: T): T & { barKg: number | null } {
  return { ...e, barKg: V1_BAR_KG[e.name] ?? null };
}

export function migrateRoutineV1(r: { id: string; name: string; exerciseIds: string[]; createdAt: number }): Routine {
  return { id: r.id, name: r.name, weekday: null, items: r.exerciseIds.map(defaultItem), createdAt: r.createdAt };
}

export function migrateWorkoutV1<T extends object>(w: T): T & { routineId: null } {
  return { ...w, routineId: null };
}

// --- 検証 ---
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const arrOf = (v: unknown, f: (x: unknown) => boolean) => Array.isArray(v) && v.every(f);
const isDateKey = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isExerciseBase = (v: unknown): v is Obj =>
  isObj(v) && isStr(v.id) && isStr(v.name) && BODY_PARTS.includes(v.bodyPart as never) &&
  ['weight', 'bodyweight', 'time'].includes(v.type as string) && isNum(v.restSec) && isBool(v.archived) && isNum(v.createdAt);
const isExercise = (v: unknown) => isExerciseBase(v) && isNumOrNull(v.barKg);

const isRoutineV1 = (v: unknown) => isObj(v) && isStr(v.id) && isStr(v.name) && arrOf(v.exerciseIds, isStr) && isNum(v.createdAt);
const isItem = (v: unknown) =>
  isObj(v) && isStr(v.exerciseId) && isNum(v.sets) && isStr(v.reps) && isBool(v.main) && isNum(v.inc) && isStr(v.note);
const isRoutine = (v: unknown) =>
  isObj(v) && isStr(v.id) && isStr(v.name) && (v.weekday === null || (Number.isInteger(v.weekday) && (v.weekday as number) >= 0 && (v.weekday as number) <= 6)) &&
  arrOf(v.items, isItem) && isNum(v.createdAt);

const isSet = (v: unknown) =>
  isObj(v) && isNumOrNull(v.weight) && isNumOrNull(v.reps) && isNumOrNull(v.durationSec) && isNumOrNull(v.rpe) &&
  isBool(v.warmup) && isStr(v.note) && isBool(v.done);
const isTarget = (v: unknown) => v === undefined || (isObj(v) && isNum(v.sets) && isStr(v.reps) && isBool(v.main) && isNum(v.inc) && isStr(v.note));
const isEntry = (v: unknown) => isObj(v) && isStr(v.exerciseId) && arrOf(v.sets, isSet) && isTarget(v.target) && (v.slowed === undefined || isBool(v.slowed));
const isCondition = (v: unknown) => isObj(v) && isNumOrNull(v.sleep) && isNumOrNull(v.fatigue) && isNumOrNull(v.motivation);
const isWorkoutBase = (v: unknown): v is Obj =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.startedAt) && isNumOrNull(v.endedAt) && isStr(v.note) &&
  isCondition(v.condition) && arrOf(v.entries, isEntry);
const isWorkout = (v: unknown) => isWorkoutBase(v) && (v.routineId === null || isStr(v.routineId));

const isBodyweight = (v: unknown) => isObj(v) && isDateKey(v.date) && isNum(v.kg);
const isSettings = (v: unknown) => isObj(v) && isNum(v.barKg) && arrOf(v.plates, isNum);
const isTest = (v: unknown) =>
  v === null || (isObj(v) && isDateKey(v.date) && isNumOrNull(v.bodyweight) && isObj(v.lifts) && Object.values(v.lifts).every(isNum));
const isProgram = (v: unknown) =>
  v === null || (isObj(v) && isDateKey(v.startDate) && isObj(v.tests) && isTest(v.tests.start) && isTest(v.tests.end));

const FAIL = 'バックアップファイルの形式が正しくありません';

export function parseBackup(text: string): BackupData {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    d = null;
  }
  if (!isObj(d) || d.app !== 'ironlog' || !isNum(d.exportedAt) || !arrOf(d.bodyweights, isBodyweight) || !isSettings(d.settings)) {
    throw new Error(FAIL);
  }
  if (d.version === 1) {
    if (!arrOf(d.exercises, isExerciseBase) || !arrOf(d.routines, isRoutineV1) || !arrOf(d.workouts, isWorkoutBase)) throw new Error(FAIL);
    return {
      ...(d as unknown as BackupData),
      version: 2,
      exercises: (d.exercises as Exercise[]).map(migrateExerciseV1),
      routines: (d.routines as Parameters<typeof migrateRoutineV1>[0][]).map(migrateRoutineV1),
      workouts: (d.workouts as Workout[]).map(migrateWorkoutV1),
      program: null,
    };
  }
  if (d.version !== 2 || !arrOf(d.exercises, isExercise) || !arrOf(d.routines, isRoutine) || !arrOf(d.workouts, isWorkout) || !isProgram(d.program)) {
    throw new Error(FAIL);
  }
  return d as unknown as BackupData;
}

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
/** 入力画面と同じ範囲の数値か（null 可） */
const inRange = (v: unknown, min: number, max: number, nullable = true) => (nullable && v === null) || (isNum(v) && v >= min && v <= max);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const arrOf = (v: unknown, f: (x: unknown) => boolean) => Array.isArray(v) && v.every(f);
const isDateKey = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isExerciseBase = (v: unknown): v is Obj =>
  isObj(v) && isStr(v.id) && isStr(v.name) && BODY_PARTS.includes(v.bodyPart as never) &&
  ['weight', 'bodyweight', 'time'].includes(v.type as string) && inRange(v.restSec, 0, 3600, false) && isBool(v.archived) && isNum(v.createdAt);
const isExercise = (v: unknown) => isExerciseBase(v) && inRange(v.barKg, 0, 100);

const isRoutineV1 = (v: unknown) => isObj(v) && isStr(v.id) && isStr(v.name) && arrOf(v.exerciseIds, isStr) && isNum(v.createdAt);
const isItem = (v: unknown) =>
  isObj(v) && isStr(v.exerciseId) && inRange(v.sets, 1, 20, false) && isStr(v.reps) && isBool(v.main) && inRange(v.inc, 0.5, 20, false) && isStr(v.note);
const isRoutine = (v: unknown) =>
  isObj(v) && isStr(v.id) && isStr(v.name) && (v.weekday === null || (Number.isInteger(v.weekday) && (v.weekday as number) >= 0 && (v.weekday as number) <= 6)) &&
  arrOf(v.items, isItem) && isNum(v.createdAt);

const isSet = (v: unknown) =>
  isObj(v) && inRange(v.weight, -200, 1000) && inRange(v.reps, 0, 999) && inRange(v.durationSec, 0, 36000) && inRange(v.rpe, 1, 10) &&
  isBool(v.warmup) && isStr(v.note) && isBool(v.done);
const isTarget = (v: unknown) => v === undefined || (isObj(v) && isNum(v.sets) && isStr(v.reps) && isBool(v.main) && isNum(v.inc) && isStr(v.note));
const isEntry = (v: unknown) => isObj(v) && isStr(v.exerciseId) && arrOf(v.sets, isSet) && isTarget(v.target) && (v.slowed === undefined || isBool(v.slowed));
const isCondition = (v: unknown) => isObj(v) && inRange(v.sleep, 1, 5) && inRange(v.fatigue, 1, 5) && inRange(v.motivation, 1, 5);
const isWorkoutBase = (v: unknown): v is Obj =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.startedAt) && isNumOrNull(v.endedAt) && isStr(v.note) &&
  isCondition(v.condition) && arrOf(v.entries, isEntry);
const isWorkout = (v: unknown) => isWorkoutBase(v) && (v.routineId === null || isStr(v.routineId));

const isBodyweight = (v: unknown) =>
  isObj(v) && isDateKey(v.date) && inRange(v.kg, 20, 300, false) && (v.fatPct === undefined || inRange(v.fatPct, 3, 60));
const isSettings = (v: unknown) => isObj(v) && inRange(v.barKg, 0, 100, false) && arrOf(v.plates, (p) => isNum(p) && p > 0);
const isTest = (v: unknown) =>
  v === null ||
  (isObj(v) && isDateKey(v.date) && inRange(v.bodyweight, 20, 300) && isObj(v.lifts) && Object.values(v.lifts).every((x) => inRange(x, 0, 1000, false)));
const isProgram = (v: unknown) =>
  v === null || (isObj(v) && isDateKey(v.startDate) && isObj(v.tests) && isTest(v.tests.start) && isTest(v.tests.end));

const FAIL = 'バックアップファイルの形式が正しくありません';

const unique = (xs: string[]) => new Set(xs).size === xs.length;

/** 重複・存在しない種目の参照・記録中ワークアウトの複数件を見つけたら理由を返す */
function inconsistency(d: BackupData): string | null {
  if (!unique(d.exercises.map((e) => e.id))) return '種目のIDが重複しています';
  if (!unique(d.routines.map((r) => r.id))) return 'ルーティンのIDが重複しています';
  if (!unique(d.workouts.map((w) => w.id))) return 'ワークアウトのIDが重複しています';
  if (!unique(d.bodyweights.map((b) => b.date))) return '体重の日付が重複しています';
  const ids = new Set(d.exercises.map((e) => e.id));
  if (d.routines.some((r) => r.items.some((i) => !ids.has(i.exerciseId)))) return 'ルーティンに存在しない種目があります';
  if (d.workouts.some((w) => w.entries.some((e) => !ids.has(e.exerciseId)))) return '記録に存在しない種目があります';
  if (d.workouts.filter((w) => w.endedAt === null).length > 1) return '記録中のワークアウトが複数あります';
  return null;
}

function checked(d: BackupData): BackupData {
  const why = inconsistency(d);
  if (why) throw new Error(`${FAIL}（${why}）`);
  return d;
}

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
    return checked({
      ...(d as unknown as BackupData),
      version: 2,
      exercises: (d.exercises as Exercise[]).map(migrateExerciseV1),
      routines: (d.routines as Parameters<typeof migrateRoutineV1>[0][]).map(migrateRoutineV1),
      workouts: (d.workouts as Workout[]).map(migrateWorkoutV1),
      program: null,
    });
  }
  if (d.version !== 2 || !arrOf(d.exercises, isExercise) || !arrOf(d.routines, isRoutine) || !arrOf(d.workouts, isWorkout) || !isProgram(d.program)) {
    throw new Error(FAIL);
  }
  return checked(d as unknown as BackupData);
}

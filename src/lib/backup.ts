import { BODY_PARTS, type BodyweightLog, type Exercise, type Routine, type Settings, type Workout } from './types';

export interface BackupData {
  app: 'ironlog';
  version: 1;
  exportedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  bodyweights: BodyweightLog[];
  settings: Settings;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const arrOf = (v: unknown, f: (x: unknown) => boolean) => Array.isArray(v) && v.every(f);

const isExercise = (v: unknown) =>
  isObj(v) && isStr(v.id) && isStr(v.name) && BODY_PARTS.includes(v.bodyPart as never) &&
  ['weight', 'bodyweight', 'time'].includes(v.type as string) && isNum(v.restSec) && isBool(v.archived) && isNum(v.createdAt);

const isRoutine = (v: unknown) =>
  isObj(v) && isStr(v.id) && isStr(v.name) && arrOf(v.exerciseIds, isStr) && isNum(v.createdAt);

const isSet = (v: unknown) =>
  isObj(v) && isNumOrNull(v.weight) && isNumOrNull(v.reps) && isNumOrNull(v.durationSec) && isNumOrNull(v.rpe) &&
  isBool(v.warmup) && isStr(v.note) && isBool(v.done);

const isEntry = (v: unknown) => isObj(v) && isStr(v.exerciseId) && arrOf(v.sets, isSet);

const isCondition = (v: unknown) => isObj(v) && isNumOrNull(v.sleep) && isNumOrNull(v.fatigue) && isNumOrNull(v.motivation);

const isWorkout = (v: unknown) =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.startedAt) && isNumOrNull(v.endedAt) && isStr(v.note) &&
  isCondition(v.condition) && arrOf(v.entries, isEntry);

const isBodyweight = (v: unknown) => isObj(v) && isStr(v.date) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && isNum(v.kg);

const isSettings = (v: unknown) => isObj(v) && isNum(v.barKg) && arrOf(v.plates, isNum);

export function parseBackup(text: string): BackupData {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    d = null;
  }
  const ok =
    isObj(d) && d.app === 'ironlog' && d.version === 1 && isNum(d.exportedAt) &&
    arrOf(d.exercises, isExercise) && arrOf(d.routines, isRoutine) && arrOf(d.workouts, isWorkout) &&
    arrOf(d.bodyweights, isBodyweight) && isSettings(d.settings);
  if (!ok) throw new Error('バックアップファイルの形式が正しくありません');
  return d as unknown as BackupData;
}

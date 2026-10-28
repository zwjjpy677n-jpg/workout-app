import { fromDateKey } from './dates';
import type { Program, Routine } from './types';

export const PROGRAM_WEEKS = 8;

/** 目標表記の最初の数値（"8〜10"→8、"左右30秒"→30）。数字が無ければ null */
export function targetNumber(reps: string): number | null {
  const m = reps.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function weekOf(startDate: string, dateKey: string): number {
  const days = Math.round((fromDateKey(dateKey).getTime() - fromDateKey(startDate).getTime()) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

export function isDeload(week: number): boolean {
  return week === 4 || week === 8;
}

export function programStatus(
  program: Program | null,
  dateKey: string,
): { active: boolean; week: number; inRange: boolean; deload: boolean; label: string } {
  if (!program) return { active: false, week: 0, inRange: false, deload: false, label: '' };
  const week = weekOf(program.startDate, dateKey);
  const inRange = week >= 1 && week <= PROGRAM_WEEKS;
  const deload = inRange && isDeload(week);
  const label = week < 1 ? '開始前' : !inRange ? '8週間完了' : deload ? '回復週：重さはそのまま、セット数を半分に' : '';
  return { active: true, week, inRange, deload, label };
}

/** ルーティンで「メイン」になっている種目（出現順・重複なし） */
export function mainExerciseIds(routines: Routine[]): string[] {
  const ids: string[] = [];
  for (const r of routines) for (const i of r.items) if (i.main && !ids.includes(i.exerciseId)) ids.push(i.exerciseId);
  return ids;
}

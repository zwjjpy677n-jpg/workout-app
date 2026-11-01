import type { Exercise, RoutineItem } from './types';

/** 1セットにかかる時間（準備・動作）の目安 */
export const SET_SEC = 45;

/**
 * ルーティンの予測時間（分、5分刻みで切り上げ）。
 * 各セットの時間 + 各セットのあとのレスト（一番最後のセットのあとは無し。種目の入れ替えはレストに含める）
 */
export function estimateMinutes(items: Pick<RoutineItem, 'exerciseId' | 'sets' | 'restSec'>[], exercises: Map<string, Exercise>, setsOf: (sets: number) => number = (n) => n): number {
  let sec = 0;
  let lastRest = 0;
  for (const it of items) {
    const sets = setsOf(it.sets);
    if (sets <= 0) continue;
    const rest = it.restSec ?? exercises.get(it.exerciseId)?.restSec ?? 90;
    sec += sets * (SET_SEC + rest);
    lastRest = rest;
  }
  sec -= lastRest;
  if (sec <= 0) return 0;
  return Math.max(5, Math.ceil(sec / 60 / 5) * 5);
}

/** 「約55分」。種目が無ければ空 */
export const estimateText = (min: number) => (min > 0 ? `約${min}分` : '');

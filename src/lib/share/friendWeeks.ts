import { DAY, endOfWeek, startOfWeek, toDateKey } from '../dates';
import { workoutVolume } from '../summary';
import type { Exercise } from '../types';
import type { FriendWorkout } from './importShare';

export type FriendWeek = { start: number; /** 日曜 00:00 */ end: number; days: number; volume: number; workouts: FriendWorkout[] };

/** 友達の記録を月曜はじまりの週に分ける（新しい週から。記録の無い週は出さない） */
export function friendWeeks(workouts: FriendWorkout[], exercises: Map<string, Exercise>): FriendWeek[] {
  const byWeek = new Map<number, FriendWorkout[]>();
  for (const w of [...workouts].sort((a, b) => b.startedAt - a.startedAt)) {
    const k = startOfWeek(w.startedAt);
    byWeek.set(k, [...(byWeek.get(k) ?? []), w]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => b - a)
    .map(([start, ws]) => ({
      start,
      end: endOfWeek(start) - DAY,
      days: new Set(ws.map((w) => toDateKey(w.startedAt))).size,
      volume: ws.reduce((v, w) => v + workoutVolume(w, exercises), 0),
      workouts: ws,
    }));
}

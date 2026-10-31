import { isWorking, topSet } from '../calc';
import { LIMIT, TYPES, type SetTuple } from '../share/sharePayload';
import type { Friend, FriendWorkout } from '../share/importShare';
import { BODY_PARTS, emptyCondition, type Exercise, type Workout, type WorkoutSet } from '../types';
import type { SharedBody, SharedCondition, SharedEntry, SharedWorkout, SharedWorkoutRow } from './types';

const tuple = (s: WorkoutSet): SetTuple => [s.weight, s.reps, s.durationSec, s.rpe];
const toSet = ([weight, reps, durationSec, rpe]: SetTuple): WorkoutSet => ({ weight, reps, durationSec, rpe, warmup: false, note: '', done: true });

/** 終わった記録を共有用に変える。本番セットとコンディションを送り、メモは入れない。終わっていない・完了セットが無いときは null */
export function toSharedWorkout(w: Workout, exercises: Map<string, Exercise>): SharedWorkout | null {
  if (w.endedAt == null) return null;
  const e: SharedEntry[] = [];
  for (const en of w.entries) {
    const ex = exercises.get(en.exerciseId);
    if (!ex) continue;
    const sets = en.sets.filter(isWorking).slice(0, LIMIT.sets).map(tuple);
    if (!sets.length) continue;
    e.push([en.exerciseId.slice(0, 8), ex.name.slice(0, LIMIT.name), BODY_PARTS.indexOf(ex.bodyPart), TYPES.indexOf(ex.type), sets]);
  }
  if (!e.length) return null;
  const { sleep, fatigue, motivation } = w.condition ?? emptyCondition();
  const c: SharedCondition = [sleep, fatigue, motivation];
  const body: SharedBody = { e: e.slice(0, LIMIT.entries), ...(c.some((v) => v != null) && { c }) };
  return { id: w.id, name: w.name.slice(0, LIMIT.name), startedAt: w.startedAt, endedAt: w.endedAt, body };
}

/** サーバーの行を友達の記録に戻す。削除済みの行は無視し、開始が古い順に返す */
export function fromSharedRows(friendId: string, rows: SharedWorkoutRow[]): { workouts: FriendWorkout[]; exercises: Exercise[] } {
  const live = rows.filter((r) => !r.deleted).sort((a, b) => a.startedAt - b.startedAt);
  const exById = new Map<string, Exercise>();
  const workouts = live.map((r): FriendWorkout => {
    const entries = r.body.e.map(([x8, name, part, type, sets]) => {
      const id = `${friendId}:${x8}`;
      // 古い順に処理するので、後から来た（新しい）名前で上書きされる
      exById.set(id, { id, name, bodyPart: BODY_PARTS[part], type: TYPES[type], restSec: 0, archived: false, createdAt: 0, barKg: null });
      return { exerciseId: id, sets: sets.map(toSet) };
    });
    return {
      id: `${friendId}:${r.id}`, friendId, name: r.name, startedAt: r.startedAt, endedAt: r.endedAt,
      note: '', condition: r.body.c ? { sleep: r.body.c[0], fatigue: r.body.c[1], motivation: r.body.c[2] } : emptyCondition(), routineId: null, entries,
    };
  });
  return { workouts, exercises: [...exById.values()] };
}

/** 種目ごとの自己ベスト */
export function friendPrs(exercises: Exercise[], workouts: FriendWorkout[]): Friend['prs'] {
  const prs: Friend['prs'] = [];
  for (const ex of exercises) {
    const sets = workouts.flatMap((w) => w.entries.filter((en) => en.exerciseId === ex.id).flatMap((en) => en.sets));
    const best = topSet(ex.type, sets);
    if (best) prs.push({ exerciseId: ex.id, set: best });
  }
  return prs;
}

/** ワークアウト時間（分）。終了が無い・開始以前（リンクで受け取った記録）は null */
export function workoutMinutes(w: { startedAt: number; endedAt: number | null }): number | null {
  if (w.endedAt == null || w.endedAt <= w.startedAt) return null;
  return Math.round((w.endedAt - w.startedAt) / 60000);
}

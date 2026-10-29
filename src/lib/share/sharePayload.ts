import { isWorking, topSet } from '../calc';
import { DAY, formatMDRange } from '../dates';
import { completed } from '../summary';
import { BODY_PARTS, type Exercise, type ExerciseType, type Routine, type Workout, type WorkoutSet } from '../types';
import { encodeShare, ShareError, shareUrl } from './codec';

export type SetTuple = [weight: number | null, reps: number | null, sec: number | null, rpe: number | null];
export type SharePayload = {
  id: string;
  n: string;
  at: number;
  x: [id8: string, name: string, part: number, type: number][];
  w: [id8: string, start: number, name: string, e: [xi: number, s: SetTuple[]][]][];
  r: [name: string, weekday: number, items: [xi: number, sets: number, reps: string, main: 0 | 1][]][];
  p: [xi: number, s: SetTuple][];
};
export type ShareSource = {
  profile: { id: string; name: string };
  exercises: Exercise[];
  workouts: Workout[];
  /** 一緒に共有するメニュー（自分で選んだものだけ。無ければ送らない） */
  routines?: Routine[];
};

export const TYPES: ExerciseType[] = ['weight', 'bodyweight', 'time'];
export const MAX_LINK = 7500;
/** 受け取る側（parseSharePayload）の上限に合わせて切り詰める。超えるとリンク全体が読めなくなるため */
export const LIMIT = { name: 40, reps: 20, entries: 50, sets: 50, menus: 30 };
const min = (ms: number) => Math.floor(ms / 60000);
const tuple = (s: WorkoutSet): SetTuple => [s.weight, s.reps, s.durationSec, s.rpe];

/** 直近 days 日の終了済みの記録（本番セットだけ）・選んだメニュー・全期間の自己ベストを詰める。体重・メモ・コンディションは入れない */
export function buildSharePayload(src: ShareSource, now: number, days = 56): SharePayload {
  const exById = new Map(src.exercises.map((e) => [e.id, e]));
  const x: SharePayload['x'] = [];
  const xIndex = new Map<string, number>();
  const ref = (id: string) => {
    let i = xIndex.get(id);
    if (i == null) {
      const e = exById.get(id)!;
      i = x.push([e.id.slice(0, 8), e.name.slice(0, LIMIT.name), BODY_PARTS.indexOf(e.bodyPart), TYPES.indexOf(e.type)]) - 1;
      xIndex.set(id, i);
    }
    return i;
  };
  const done = completed(src.workouts).sort((a, b) => a.startedAt - b.startedAt);

  const w: SharePayload['w'] = [];
  for (const wo of done) {
    if (wo.startedAt < now - days * DAY) continue;
    const e = wo.entries
      .filter((en) => exById.has(en.exerciseId))
      .map((en) => [en.exerciseId, en.sets.filter(isWorking).slice(0, LIMIT.sets).map(tuple)] as const)
      .filter(([, sets]) => sets.length > 0)
      .map(([id, sets]): [number, SetTuple[]] => [ref(id), sets]);
    if (e.length) w.push([wo.id.slice(0, 8), min(wo.startedAt), wo.name.slice(0, LIMIT.name), e.slice(0, LIMIT.entries)]);
  }

  // メニューは自分で選んだものだけ送る（選ばなければ空）
  const r: SharePayload['r'] = (src.routines ?? []).slice(0, LIMIT.menus).map((ro) => [
    ro.name.slice(0, LIMIT.name),
    ro.weekday ?? -1,
    ro.items
      .filter((it) => exById.has(it.exerciseId))
      .slice(0, LIMIT.entries)
      .map((it): [number, number, string, 0 | 1] => [ref(it.exerciseId), it.sets, it.reps.slice(0, LIMIT.reps), it.main ? 1 : 0]),
  ]);

  const p: SharePayload['p'] = [];
  for (const id of [...xIndex.keys()]) {
    const best = topSet(exById.get(id)!.type, done.flatMap((wo) => wo.entries.filter((en) => en.exerciseId === id).flatMap((en) => en.sets)));
    if (best) p.push([xIndex.get(id)!, tuple(best)]);
  }
  return { id: src.profile.id, n: src.profile.name, at: min(now), x, w, r, p };
}

/** 7,500 文字に収まるまで古い週を削ってリンクと送る文を作る */
export async function buildShareLink(src: ShareSource, now: number) {
  for (let weeks = 8; weeks >= 1; weeks--) {
    const p = buildSharePayload(src, now, weeks * 7);
    const link = shareUrl(await encodeShare('r', p));
    if (link.length > MAX_LINK) continue;
    const starts = p.w.map((wo) => wo[1] * 60000);
    const from = starts.length ? Math.min(...starts) : now;
    const to = starts.length ? Math.max(...starts) : now;
    const range = starts.length ? `${formatMDRange(from, to)}・` : '';
    const text = `キントレ部 の記録です（${range}${p.w.length}回分）。キントレ部 の『友達』タブに貼り付けてね\n${link}`;
    return { text, weeks, trimmed: weeks < 8, count: p.w.length, from, to };
  }
  throw new ShareError('too-large');
}

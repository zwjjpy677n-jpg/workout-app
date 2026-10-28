import { formatKg, isWorking } from './calc';
import { targetNumber } from './program';
import type { EntryTarget, ExerciseType, WorkoutSet } from './types';

export type Suggestion = { sets: number; weight: number | null; reps: number | null; durationSec: number | null; reason: string };

const round2 = (x: number) => Math.round(x * 100) / 100;

export function suggest(args: {
  target: EntryTarget;
  type: ExerciseType;
  prev: { sets: WorkoutSet[]; slowed: boolean } | null;
  deload: boolean;
}): Suggestion {
  const { target, type, prev, deload } = args;
  const sets = deload ? Math.max(1, Math.ceil(target.sets / 2)) : target.sets;
  const r = targetNumber(target.reps);
  const base = { sets, reps: type === 'time' ? null : r, durationSec: type === 'time' ? r : null };
  const working = prev?.sets.filter(isWorking) ?? [];
  // 自重種目のアシスト（負の加重）も残すため、入力のある重量だけで最大を取る。無ければ 0
  const weights = working.map((s) => s.weight).filter((w): w is number => w != null);
  const lw = weights.length ? Math.max(...weights) : 0;

  if (type !== 'weight') {
    return {
      ...base,
      weight: type === 'bodyweight' && lw !== 0 ? lw : null,
      reason: deload ? '回復週：セット数を減らして軽めに' : '前回より質を上げることを意識',
    };
  }
  if (lw === 0) return { ...base, weight: null, reason: '初回：フォームが崩れず、目標回数をきれいにこなせる重さで' };
  if (deload) return { ...base, weight: lw, reason: '回復週：重さはそのまま、セット数を半分に' };

  const hit = r == null || working.filter((s) => s.weight === lw).every((s) => (s.reps ?? 0) >= r);
  const up = { ...base, weight: round2(lw + target.inc) };
  const same = { ...base, weight: lw };
  if (target.main) {
    if (prev?.slowed) return { ...same, reason: '前回スピードが落ちたので、同じ重さでやり直し' };
    if (!hit) return { ...same, reason: '前回は目標回数に届かなかったので、同じ重さ' };
    return { ...up, reason: `前回はスピードを保てたので+${formatKg(target.inc)}kg` };
  }
  return hit ? { ...up, reason: `全セット目標回数に届いたので+${formatKg(target.inc)}kg` } : { ...same, reason: '全セットで目標回数に届くまで同じ重さ' };
}

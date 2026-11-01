import { estimate1RM, formatDuration, formatKg, topSet } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { deloadSets } from '../../lib/program';
import type { EntryTarget, Exercise, Workout, WorkoutEntry } from '../../lib/types';
import { summarizeSets } from '../calendar/summarizeSets';
import s from './workout.module.css';

type Props = {
  exercise: Exercise;
  target: EntryTarget;
  prev: { workout: Workout; entry: WorkoutEntry } | null;
  deload: boolean;
};

/** 開いた種目の上に出す目安。おすすめの重さは出さず、前回の重さを薄く出す */
export function SuggestionBlock({ exercise, target, prev, deload }: Props) {
  const prevTop = prev && topSet(exercise.type, prev.entry.sets);
  const e1 = exercise.type === 'weight' && prevTop ? estimate1RM(prevTop.weight, prevTop.reps) : 0;
  return (
    <>
      <p className={s.prevFaint}>
        {prev ? `前回（${formatMD(prev.workout.startedAt)}） ${summarizeSets(exercise.type, prev.entry.sets)}` : '前回の記録なし'}
      </p>
      <div className={s.info}>
        <span>目標<b>{`${deloadSets(target.sets, deload)}セット×${target.reps}`}</b></span>
        {e1 > 0 && <span>前回の推定1RM<b>{formatKg(Math.round(e1 * 10) / 10)}kg</b></span>}
        <span>レスト<b>{formatDuration(target.restSec ?? exercise.restSec)}</b></span>
        {prev?.entry.slowed && <span>前回はスピードが落ちた</span>}
      </div>
      {target.note && <p className={s.targetNote}>{target.note}</p>}
    </>
  );
}

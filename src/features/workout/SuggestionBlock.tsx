import { PlateBar } from '../../components/PlateBar';
import { estimate1RM, formatDuration, formatKg, topSet } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { suggest } from '../../lib/suggest';
import type { EntryTarget, Exercise, Workout, WorkoutEntry } from '../../lib/types';
import { summarizeSets } from '../calendar/summarizeSets';
import s from './workout.module.css';

type Props = {
  exercise: Exercise;
  target: EntryTarget;
  prev: { workout: Workout; entry: WorkoutEntry } | null;
  deload: boolean;
  plates: number[];
};

export function SuggestionBlock({ exercise, target, prev, deload, plates }: Props) {
  const sg = suggest({ target, type: exercise.type, prev: prev && { sets: prev.entry.sets, slowed: !!prev.entry.slowed }, deload });
  const showWeight = exercise.type === 'weight' && sg.weight != null && sg.weight > 0;
  const prevTop = prev && topSet(exercise.type, prev.entry.sets);
  const e1 = exercise.type === 'weight' && prevTop ? estimate1RM(prevTop.weight, prevTop.reps) : 0;
  return (
    <>
      <div className={s.sugg}>
        <div className={s.suggLabel}>{showWeight ? '今回のおすすめ' : '今回の目標'}</div>
        {showWeight ? (
          <div className={s.suggBig}>
            <span>{formatKg(sg.weight!)}</span>
            <small>kg</small>
            <em>×{target.reps}</em>
          </div>
        ) : (
          <div className={s.suggGoal}>{target.reps}</div>
        )}
        {showWeight && exercise.barKg != null && <PlateBar targetKg={sg.weight!} barKg={exercise.barKg} plates={plates} />}
        <div className={s.reason}>{sg.reason}</div>
      </div>
      <div className={s.info}>
        <span>前回{prev ? `（${formatMD(prev.workout.startedAt)}）` : ''}<b>{prev ? summarizeSets(exercise.type, prev.entry.sets) : 'なし'}</b></span>
        <span>目標<b>{sg.sets}セット</b></span>
        {e1 > 0 && <span>前回の推定1RM<b>{formatKg(Math.round(e1 * 10) / 10)}kg</b></span>}
        <span>レスト<b>{formatDuration(target.restSec ?? exercise.restSec)}</b></span>
        {prev?.entry.slowed && <span>前回はスピードが落ちた</span>}
      </div>
      {target.note && <p className={s.targetNote}>{target.note}</p>}
    </>
  );
}

import { NumberInput } from '../../components/NumberInput';
import { Stepper } from '../../components/Stepper';
import type { ExerciseType, WorkoutSet } from '../../lib/types';
import { shortSet } from './format';
import s from './workout.module.css';

type Props = {
  type: ExerciseType;
  set: WorkoutSet;
  number: number | null;
  prevSet: WorkoutSet | null;
  placeholder: WorkoutSet | null;
  weightStep: number;
  canRemove: boolean;
  onChange(patch: Partial<WorkoutSet>): void;
  onToggleWarmup(): void;
  onToggleDone(): void;
  onRemove(): void;
  onNote(): void;
};

export function SetCard({ type, set, number, prevSet, placeholder, weightStep, canRemove, onChange, onToggleWarmup, onToggleDone, onRemove, onNote }: Props) {
  const label = set.warmup ? 'ウォームアップ' : `${number}セット目`;
  // 「自重」は 0kg（自重種目なら加重なし）として記録する
  const bw = type !== 'time' && set.weight === 0;
  return (
    <div role="group" aria-label={label} className={`${s.setCard} ${set.done ? s.isDone : ''}`}>
      <div className={s.setTop}>
        <button type="button" className={`${s.setNo2} ${set.warmup ? s.warm : ''}`} onClick={onToggleWarmup} title="タップでウォームアップ切替">
          {set.warmup ? 'W' : number}
          <small>{set.warmup ? 'ウォームアップ' : 'セット目'}</small>
        </button>
        <span className={s.setPrev}>{prevSet ? `前回 ${shortSet(type, prevSet)}` : ''}</span>
        {type !== 'time' && (
          <button type="button" aria-pressed={bw} className={s.bwBtn} onClick={() => onChange({ weight: bw ? null : 0 })}>自重</button>
        )}
        <button type="button" aria-label="メモ" className={`${s.iconBtn} ${set.note ? s.has : ''}`} onClick={onNote}>✎</button>
        {canRemove && <button type="button" aria-label={`${label}を削除`} className={s.iconBtn} onClick={onRemove}>×</button>}
        <button type="button" aria-label="完了" aria-pressed={set.done} className={s.doneBtn} onClick={onToggleDone}>
          {set.done ? 'できた' : '完了'}
        </button>
      </div>
      <div className={`${s.inputs} ${type === 'time' ? s.single : ''}`}>
        {type === 'time' ? (
          <Stepper label="秒" unit="秒" value={set.durationSec} placeholder={placeholder?.durationSec} onChange={(v) => onChange({ durationSec: v })} step={5} min={0} max={36000} inputMode="numeric" />
        ) : (
          <>
            {bw ? (
              <div className={s.bwField}>自重</div>
            ) : (
              <Stepper
                label="重量"
                unit={type === 'bodyweight' ? '+kg' : 'kg'}
                value={set.weight}
                placeholder={placeholder?.weight}
                onChange={(v) => onChange({ weight: v })}
                step={weightStep}
                min={type === 'bodyweight' ? -200 : 0}
                max={1000}
                inputMode="decimal"
              />
            )}
            <Stepper label="回数" unit="回" value={set.reps} placeholder={placeholder?.reps} onChange={(v) => onChange({ reps: v })} step={1} min={0} max={999} inputMode="numeric" />
          </>
        )}
        <label className={s.rpe}>
          <span>RPE</span>
          <NumberInput aria-label="RPE" value={set.rpe} onChange={(v) => onChange({ rpe: v })} min={1} max={10} inputMode="decimal" />
        </label>
      </div>
    </div>
  );
}

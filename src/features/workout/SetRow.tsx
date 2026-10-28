import { NumberInput } from '../../components/NumberInput';
import type { ExerciseType, WorkoutSet } from '../../lib/types';
import { shortSet } from './format';
import s from './workout.module.css';

type Props = {
  type: ExerciseType;
  set: WorkoutSet;
  number: number | null;
  placeholder: WorkoutSet | null;
  onChange(patch: Partial<WorkoutSet>): void;
  onToggleWarmup(): void;
  onToggleDone(): void;
  onNote(): void;
};

const ph = (v: number | null | undefined) => (v == null ? undefined : String(v));

export function SetRow({ type, set, number, placeholder, onChange, onToggleWarmup, onToggleDone, onNote }: Props) {
  return (
    <tr className={set.done ? s.done : undefined}>
      <td>
        <button type="button" className={`${s.setNo} ${set.warmup ? s.warm : ''}`} onClick={onToggleWarmup} title="タップでウォームアップ切替">
          {set.warmup ? 'W' : number}
        </button>
      </td>
      <td className={s.pv}>{placeholder ? shortSet(type, placeholder) : '–'}</td>
      {type === 'time' ? (
        <td colSpan={2}>
          <NumberInput aria-label="秒" value={set.durationSec} onChange={(v) => onChange({ durationSec: v })} min={0} max={36000} inputMode="numeric" placeholder={ph(placeholder?.durationSec)} />
        </td>
      ) : (
        <>
          <td>
            <NumberInput
              aria-label="重量"
              value={set.weight}
              onChange={(v) => onChange({ weight: v })}
              min={type === 'bodyweight' ? -200 : 0}
              max={1000}
              inputMode="decimal"
              placeholder={ph(placeholder?.weight) ?? (type === 'bodyweight' ? '0' : undefined)}
            />
          </td>
          <td>
            <NumberInput aria-label="回数" value={set.reps} onChange={(v) => onChange({ reps: v })} min={0} max={999} inputMode="numeric" placeholder={ph(placeholder?.reps)} />
          </td>
        </>
      )}
      <td>
        <NumberInput aria-label="RPE" value={set.rpe} onChange={(v) => onChange({ rpe: v })} min={1} max={10} inputMode="decimal" />
      </td>
      <td>
        <button type="button" aria-label="メモ" className={`${s.noteBtn} ${set.note ? s.has : ''}`} onClick={onNote}>✎</button>
      </td>
      <td>
        <button type="button" aria-label="完了" aria-pressed={set.done} className={s.check} onClick={onToggleDone}>
          <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
        </button>
      </td>
    </tr>
  );
}

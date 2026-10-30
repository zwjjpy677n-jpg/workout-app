import { Stepper } from '../../../../src/components/Stepper';
import { setValue, toggleCheck } from '../../db/repo';
import type { Item, Log } from '../../lib/types';
import s from './today.module.css';

export function RoutineRow({ item, log, date }: { item: Item; log: Log | undefined; date: string }) {
  const done = !!log?.done;
  if (item.kind === 'check') {
    return (
      <button type="button" role="checkbox" aria-checked={done} aria-label={item.name} className={`${s.row} ${done ? s.done : ''}`} onClick={() => void toggleCheck(date, item.id)}>
        <span className={s.box} aria-hidden="true">{done ? '✓' : ''}</span>
        <span className={s.name}>{item.name}</span>
      </button>
    );
  }
  const target = item.target ?? 0;
  const value = log?.value ?? null;
  return (
    <div className={`${s.row} ${s.numRow} ${done ? s.done : ''}`}>
      <span className={s.box} role="img" aria-label={`${item.name} ${done ? 'できた' : 'まだ'}`}>{done ? '✓' : ''}</span>
      <span className={s.name}>
        {item.name}
        <small className="muted">{`${value ?? 0} / ${target} ${item.unit ?? ''}`.trim()}</small>
      </span>
      <div className={s.stepper}>
        <Stepper
          label={item.name}
          value={value}
          onChange={(v) => void setValue(date, item, v)}
          step={item.step ?? 1}
          min={0}
          max={Math.max(target * 10, 1)}
          unit={item.unit ?? ''}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

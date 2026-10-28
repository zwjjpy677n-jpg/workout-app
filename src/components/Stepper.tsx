import { NumberInput } from './NumberInput';
import s from './Stepper.module.css';

type Props = {
  value: number | null;
  onChange(v: number | null): void;
  step: number;
  min: number;
  max: number;
  unit: string;
  inputMode: 'decimal' | 'numeric';
  label: string;
};

const round2 = (x: number) => Math.round(x * 100) / 100;

export function Stepper({ value, onChange, step, min, max, unit, inputMode, label }: Props) {
  const bump = (dir: 1 | -1) => {
    const base = value ?? (dir > 0 ? 0 : min);
    onChange(round2(Math.min(max, Math.max(min, value == null && dir < 0 ? min : base + step * dir))));
  };
  return (
    <div className={s.stepper}>
      <button type="button" aria-label={`${label}を減らす`} onClick={() => bump(-1)}>−</button>
      <label className={s.field}>
        <NumberInput aria-label={label} value={value} onChange={onChange} min={min} max={max} inputMode={inputMode} className={s.input} />
        <i>{unit}</i>
      </label>
      <button type="button" aria-label={`${label}を増やす`} onClick={() => bump(1)}>+</button>
    </div>
  );
}

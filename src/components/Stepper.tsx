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
  /** 値が空のときの薄い表示。＋/−はこの値を基準にする */
  placeholder?: number | null;
};

const round2 = (x: number) => Math.round(x * 100) / 100;

export function Stepper({ value, onChange, step, min, max, unit, inputMode, label, placeholder }: Props) {
  const bump = (dir: 1 | -1) => {
    const base = value ?? placeholder;
    const next = base == null ? (dir > 0 ? step : min) : base + step * dir;
    onChange(round2(Math.min(max, Math.max(min, next))));
  };
  return (
    <div className={s.stepper}>
      <button type="button" aria-label={`${label}を減らす`} onClick={() => bump(-1)}>−</button>
      <label className={s.field}>
        <NumberInput aria-label={label} value={value} onChange={onChange} min={min} max={max} inputMode={inputMode} className={s.input} placeholder={placeholder == null ? undefined : String(placeholder)} />
        <i>{unit}</i>
      </label>
      <button type="button" aria-label={`${label}を増やす`} onClick={() => bump(1)}>+</button>
    </div>
  );
}

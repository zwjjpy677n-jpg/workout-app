import s from './RatingInput.module.css';

export function RatingInput({ value, onChange, label }: { value: number | null; onChange(v: number | null): void; label: string }) {
  return (
    <div className={s.row} role="group" aria-label={label}>
      <span className={s.label}>{label}</span>
      <div className={s.btns}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} className={`${s.b} ${value === n ? s.on : ''}`} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

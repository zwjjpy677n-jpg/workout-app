import { useEffect, useState, type InputHTMLAttributes } from 'react';
import s from './NumberInput.module.css';

type Props = {
  value: number | null;
  onChange(v: number | null): void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  inputMode: 'decimal' | 'numeric';
  'aria-label': string;
  className?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoFocus' | 'onFocus'>;

const show = (v: number | null) => (v == null ? '' : String(v));

export function NumberInput({ value, onChange, min, max, placeholder, inputMode, className, ...rest }: Props) {
  const [text, setText] = useState(show(value));

  useEffect(() => {
    setText((t) => (t !== '' && Number(t) === value ? t : show(value)));
  }, [value]);

  function handle(next: string) {
    setText(next);
    if (next.trim() === '') return onChange(null);
    const n = Number(next);
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
  }

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={`${s.input} ${className ?? ''}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => handle(e.target.value)}
      onBlur={() => setText(show(value))}
      {...rest}
    />
  );
}

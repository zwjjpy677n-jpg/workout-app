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
  /** blur しても範囲外・空の入力を元に戻さず、invalid 表示のまま残す */
  keepInvalid?: boolean;
  /** 範囲外・非数かどうかが変わったら呼ばれる */
  onInvalidChange?(invalid: boolean): void;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoFocus' | 'onFocus'>;

const show = (v: number | null) => (v == null ? '' : String(v));

export function NumberInput({ value, onChange, min, max, placeholder, inputMode, className, keepInvalid, onInvalidChange, ...rest }: Props) {
  const [text, setText] = useState(show(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText((t) => (t !== '' && Number(t) === value ? t : invalid && value == null ? t : show(value)));
  }, [value]);

  function handle(next: string) {
    setText(next);
    const n = Number(next);
    const empty = next.trim() === '';
    // keepInvalid の欄では空も「未入力」として赤く残す（勝手に元の値へ戻さない）
    const ok = empty ? !keepInvalid : Number.isFinite(n) && n >= min && n <= max;
    setInvalid(!ok);
    onInvalidChange?.(!ok);
    // 範囲外・非数は途中の値を残さず null にする（表示と保存値を食い違わせない）
    onChange(ok && !empty ? n : null);
  }

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={`${s.input} ${className ?? ''}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => handle(e.target.value)}
      aria-invalid={invalid || undefined}
      onBlur={() => {
        if (keepInvalid && invalid) return;
        if (invalid) onInvalidChange?.(false);
        setInvalid(false);
        setText(show(value));
      }}
      {...rest}
    />
  );
}

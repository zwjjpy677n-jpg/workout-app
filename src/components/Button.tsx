import type { ButtonHTMLAttributes } from 'react';
import s from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; block?: boolean };

export function Button({ variant = 'ghost', block, className, type = 'button', ...rest }: Props) {
  return <button type={type} className={`${s.btn} ${s[variant]} ${block ? s.block : ''} ${className ?? ''}`} {...rest} />;
}

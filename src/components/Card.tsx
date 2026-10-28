import type { ReactNode } from 'react';
import s from './Card.module.css';

export function Card({ children, onClick, className }: { children: ReactNode; onClick?(): void; className?: string }) {
  if (onClick) {
    return <button type="button" className={`${s.card} ${s.click} ${className ?? ''}`} onClick={onClick}>{children}</button>;
  }
  return <div className={`${s.card} ${className ?? ''}`}>{children}</div>;
}

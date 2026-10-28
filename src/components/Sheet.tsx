import type { ReactNode } from 'react';
import s from './Sheet.module.css';

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className={s.backdrop} onClick={onClose}>
      <div role="dialog" aria-label={title} className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <h2>{title}</h2>
          <button type="button" aria-label="閉じる" className={s.close} onClick={onClose}>×</button>
        </div>
        <div className={s.body}>{children}</div>
      </div>
    </div>
  );
}

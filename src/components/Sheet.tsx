import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import s from './Sheet.module.css';

/**
 * iPhone ではキーボードが画面の下に重なるだけで、下に寄せたシートの保存ボタンが隠れる。
 * キーボードが出ている間は、シートを見えている範囲（visualViewport）に合わせて持ち上げる
 */
function useKeyboardBox(open: boolean): CSSProperties | undefined {
  const [box, setBox] = useState<CSSProperties>();
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const update = () =>
      setBox(vv.height < window.innerHeight - 100 ? { top: vv.offsetTop, height: vv.height, bottom: 'auto' } : undefined);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);
  return box;
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const box = useKeyboardBox(open);
  if (!open) return null;
  return (
    <div className={s.backdrop} style={box} onClick={onClose}>
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

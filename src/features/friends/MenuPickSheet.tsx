import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useRoutines } from '../../hooks/useData';
import { WEEKDAY_LABEL } from '../../lib/types';
import s from './friends.module.css';

type Props = { open: boolean; selected: string[]; onDone(ids: string[]): void; onClose(): void };

/** 記録と一緒に共有するメニューを選ぶ（何も選ばなければメニューは送らない） */
export function MenuPickSheet({ open, selected, onDone, onClose }: Props) {
  const routines = useRoutines() ?? [];
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  useEffect(() => {
    if (open) setPicked(new Set(selected));
  }, [open, selected]);
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Sheet open={open} title="共有するメニュー" onClose={onClose}>
      <p className={s.hint}>選んだメニューだけ、記録と一緒に友達に届きます</p>
      {routines.length === 0 && <p className={s.empty}>メニュー（ルーティン）がありません</p>}
      {routines.map((r) => (
        <label key={r.id} className={s.checkRow}>
          <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
          {r.weekday == null ? r.name : `${r.name}（${WEEKDAY_LABEL[r.weekday]}）`}
        </label>
      ))}
      <Button block variant="primary" onClick={() => onDone(routines.filter((r) => picked.has(r.id)).map((r) => r.id))}>決定</Button>
    </Sheet>
  );
}

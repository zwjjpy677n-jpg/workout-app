import { useState } from 'react';
import { Button } from '../../../../src/components/Button';
import { Sheet } from '../../../../src/components/Sheet';
import { formatMD, fromDateKey } from '../../../../src/lib/dates';
import { carryOver } from '../../db/repo';
import type { Todo } from '../../lib/types';
import s from './today.module.css';

/** 10/29 のような表示 */
export const md = (date: string) => formatMD(fromDateKey(date).getTime());

/** 前の日の未完了を選んで今日に移す。最初は全部選んである */
export function CarrySheet({ pending, today, onClose }: { pending: Todo[]; today: string; onClose(): void }) {
  const [picked, setPicked] = useState(() => new Set(pending.map((t) => t.id)));
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Sheet open title="持ち越す" onClose={onClose}>
      <div className={s.picks}>
        {pending.map((t) => (
          <label key={t.id} className={s.pick}>
            <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
            <span>{t.text}</span>
            <small className="muted">{md(t.date)}</small>
          </label>
        ))}
      </div>
      <Button
        variant="primary"
        block
        disabled={picked.size === 0}
        onClick={async () => {
          await carryOver(pending.filter((t) => picked.has(t.id)).map((t) => t.id), today);
          onClose();
        }}
      >
        持ち越す
      </Button>
    </Sheet>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Button } from '../../../../src/components/Button';
import { db } from '../../db/db';
import { moveItem } from '../../db/repo';
import { SLOTS, type Item } from '../../lib/types';
import { ItemSheet } from './ItemSheet';
import s from './routines.module.css';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

function describe(it: Item): string {
  const days = it.days.length === 7 ? '毎日' : it.days.map((d) => WD[d]).join('・');
  return it.kind === 'number' ? `${days} ／ 目標 ${it.target}${it.unit ?? ''}` : days;
}

export function RoutinesPage() {
  const items = useLiveQuery(() => db.items.filter((it) => it.deletedAt == null).toArray(), []);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);

  return (
    <div className="page">
      <h1 className="page-title">ルーティン</h1>
      <Button variant="primary" block onClick={() => setEditing('new')}>項目を追加</Button>
      {items &&
        SLOTS.map(({ key, label }) => {
          const list = items.filter((it) => it.slot === key).sort((a, b) => a.order - b.order);
          return (
            <section key={key} aria-labelledby={`slot-${key}`}>
              <h2 id={`slot-${key}`} className="sec">{label}</h2>
              {list.length === 0 && <p className="muted">まだありません</p>}
              <div className={s.list}>
                {list.map((it, i) => (
                  <div key={it.id} className={`${s.row} ${it.active ? '' : s.paused}`}>
                    <button type="button" aria-label={`${it.name}を編集`} className={s.main} onClick={() => setEditing(it)}>
                      <span>{it.name}</span>
                      <small className="muted">{describe(it)}</small>
                    </button>
                    {!it.active && <span className={s.badge}>休止中</span>}
                    <button type="button" aria-label={`${it.name}を上へ`} className={s.move} disabled={i === 0} onClick={() => void moveItem(it.id, -1)}>↑</button>
                    <button type="button" aria-label={`${it.name}を下へ`} className={s.move} disabled={i === list.length - 1} onClick={() => void moveItem(it.id, 1)}>↓</button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      {editing && <ItemSheet item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

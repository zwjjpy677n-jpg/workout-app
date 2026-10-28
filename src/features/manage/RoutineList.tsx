import { useState } from 'react';
import { Button } from '../../components/Button';
import { useRoutines } from '../../hooks/useData';
import type { Routine } from '../../lib/types';
import { RoutineForm } from './RoutineForm';
import s from './manage.module.css';

export function RoutineList() {
  const routines = useRoutines();
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  return (
    <>
      <Button block onClick={() => setEditing('new')}>＋ ルーティンを追加</Button>
      <div className={s.list} style={{ marginTop: 14 }}>
        {routines?.length === 0 && <p className={s.empty}>「PUSH」「脚の日」などのメニューを登録すると、ホームからワンタップで開始できます</p>}
        {routines?.map((r) => (
          <button key={r.id} type="button" className={s.item} onClick={() => setEditing(r)}>
            <div>
              <div>{r.name}</div>
              <div className={s.sub}>{r.items.length}種目</div>
            </div>
            <span className={s.chev}>›</span>
          </button>
        ))}
      </div>
      {editing && <RoutineForm routine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

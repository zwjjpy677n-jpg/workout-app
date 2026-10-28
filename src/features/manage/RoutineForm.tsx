import { useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { deleteRoutine, saveRoutine } from '../../db/repository';
import { useExerciseMap, useExercises } from '../../hooks/useData';
import { BODY_PART_LABEL, BODY_PARTS, type Routine } from '../../lib/types';
import s from './manage.module.css';

export function RoutineForm({ routine, onClose }: { routine: Routine | null; onClose(): void }) {
  const exercises = useExercises();
  const map = useExerciseMap();
  const [name, setName] = useState(routine?.name ?? '');
  const [ids, setIds] = useState<string[]>(routine?.exerciseIds ?? []);
  const [error, setError] = useState('');

  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const move = (i: number, d: number) =>
    setIds((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save() {
    if (!name.trim()) return setError('名前を入力してください');
    if (ids.length === 0) return setError('種目を1つ以上選んでください');
    await saveRoutine({ ...routine, name: name.trim(), exerciseIds: ids });
    onClose();
  }

  async function remove() {
    if (routine && window.confirm(`ルーティン「${routine.name}」を削除しますか？`)) {
      await deleteRoutine(routine.id);
      onClose();
    }
  }

  return (
    <Sheet open title={routine ? 'ルーティンを編集' : 'ルーティンを追加'} onClose={onClose}>
      <label className={s.field}>
        <span>ルーティン名</span>
        <input className={s.text} aria-label="ルーティン名" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {ids.length > 0 && (
        <div className={s.field}>
          <span>順番</span>
          {ids.map((id, i) => (
            <div key={id} className={s.order}>
              <span>{map?.get(id)?.name ?? '—'}</span>
              <button type="button" aria-label="上へ" onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="下へ" onClick={() => move(i, 1)}>↓</button>
            </div>
          ))}
        </div>
      )}
      {BODY_PARTS.map((bp) => {
        const items = exercises?.filter((e) => e.bodyPart === bp) ?? [];
        if (!items.length) return null;
        return (
          <div key={bp} className={s.group}>
            <h3>{BODY_PART_LABEL[bp]}</h3>
            {items.map((e) => (
              <label key={e.id} className={s.check}>
                <input type="checkbox" checked={ids.includes(e.id)} onChange={() => toggle(e.id)} />
                {e.name}
              </label>
            ))}
          </div>
        );
      })}
      {error && <p className={s.error}>{error}</p>}
      <div className={s.actions}>
        {routine && <Button variant="danger" onClick={remove}>削除</Button>}
        <Button variant="primary" onClick={save}>保存</Button>
      </div>
    </Sheet>
  );
}

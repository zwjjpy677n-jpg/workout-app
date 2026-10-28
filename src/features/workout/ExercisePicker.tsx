import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useExercises } from '../../hooks/useData';
import { BODY_PART_LABEL, BODY_PARTS, type BodyPart } from '../../lib/types';
import s from './workout.module.css';

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose(): void; onPick(id: string): void }) {
  const exercises = useExercises();
  const [part, setPart] = useState<BodyPart | null>(null);
  const [q, setQ] = useState('');
  const list = (exercises ?? []).filter((e) => (!part || e.bodyPart === part) && e.name.includes(q.trim()));

  return (
    <Sheet open={open} title="種目を追加" onClose={onClose}>
      <input className={s.search} aria-label="種目を検索" placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className={s.filters}>
        <button type="button" aria-pressed={part === null} onClick={() => setPart(null)}>すべて</button>
        {BODY_PARTS.map((b) => (
          <button key={b} type="button" aria-pressed={part === b} onClick={() => setPart(b)}>{BODY_PART_LABEL[b]}</button>
        ))}
      </div>
      <div className={s.pickList}>
        {list.map((e) => (
          <button key={e.id} type="button" onClick={() => { onPick(e.id); onClose(); }}>{e.name}</button>
        ))}
        {list.length === 0 && <p className="muted" style={{ fontSize: 13, padding: 16, textAlign: 'center' }}>該当する種目がありません</p>}
      </div>
    </Sheet>
  );
}

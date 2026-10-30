import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { addExercise } from '../../db/repository';
import { useExercises } from '../../hooks/useData';
import { BODY_PART_LABEL, BODY_PARTS, EXERCISE_TYPE_LABEL, type BodyPart, type ExerciseType } from '../../lib/types';
import s from './workout.module.css';

const TYPES: ExerciseType[] = ['weight', 'bodyweight', 'time'];
const NAME_MAX = 40;

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose(): void; onPick(id: string): void }) {
  const exercises = useExercises();
  const [part, setPart] = useState<BodyPart | null>(null);
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(false);
  const list = (exercises ?? []).filter((e) => (!part || e.bodyPart === part) && e.name.includes(q.trim()));

  useEffect(() => {
    if (!open) setMaking(false);
  }, [open]);

  const pick = (id: string) => {
    onPick(id);
    onClose();
  };

  return (
    <Sheet open={open} title="種目を追加" onClose={onClose}>
      {making ? (
        <NewExercise initialName={q.trim()} initialPart={part ?? 'chest'} onCancel={() => setMaking(false)} onMade={pick} />
      ) : (
        <>
          <input className={s.search} aria-label="種目を検索" placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className={s.filters}>
            <button type="button" aria-pressed={part === null} onClick={() => setPart(null)}>すべて</button>
            {BODY_PARTS.map((b) => (
              <button key={b} type="button" aria-pressed={part === b} onClick={() => setPart(b)}>{BODY_PART_LABEL[b]}</button>
            ))}
          </div>
          <div className={s.pickList}>
            {list.map((e) => (
              <button key={e.id} type="button" onClick={() => pick(e.id)}>{e.name}</button>
            ))}
            {list.length === 0 && <p className="muted" style={{ fontSize: 13, padding: 16, textAlign: 'center' }}>該当する種目がありません</p>}
          </div>
          <Button block className={s.newExBtn} onClick={() => setMaking(true)}>＋ 新しい種目を作る</Button>
        </>
      )}
    </Sheet>
  );
}

/** その場で種目を作って、そのまま追加する（管理の「種目」にも入る） */
function NewExercise({ initialName, initialPart, onCancel, onMade }: { initialName: string; initialPart: BodyPart; onCancel(): void; onMade(id: string): void }) {
  const exercises = useExercises();
  const [name, setName] = useState(initialName);
  const [part, setPart] = useState<BodyPart>(initialPart);
  const [type, setType] = useState<ExerciseType>('weight');
  const busy = useRef(false);
  const v = name.trim();
  const same = (exercises ?? []).find((e) => e.name.trim() === v);

  const make = async () => {
    if (!v || busy.current) return;
    // 同じ名前の種目があれば、新しく作らずにそれを使う
    if (same) return onMade(same.id);
    busy.current = true;
    try {
      const e = await addExercise({ name: v, bodyPart: part, type, restSec: 90, barKg: null });
      onMade(e.id);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className={s.newEx}>
      <input className={s.search} aria-label="新しい種目の名前" placeholder="種目の名前（例: インクラインダンベルプレス）" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      <div className={s.filters} role="group" aria-label="部位">
        {BODY_PARTS.map((b) => (
          <button key={b} type="button" aria-pressed={part === b} onClick={() => setPart(b)}>{BODY_PART_LABEL[b]}</button>
        ))}
      </div>
      <div className={s.filters} role="group" aria-label="タイプ">
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{EXERCISE_TYPE_LABEL[t]}</button>
        ))}
      </div>
      {same && <p className={s.newExNote}>{`「${same.name}」はもうあります。押すとその種目を追加します`}</p>}
      <Button block variant="primary" disabled={!v} onClick={() => void make()}>{same ? 'この種目を追加' : '作って追加'}</Button>
      <Button block onClick={onCancel}>一覧に戻る</Button>
      <p className={s.newExNote}>作った種目は「管理 → 種目」で名前やレスト時間を直せます</p>
    </div>
  );
}

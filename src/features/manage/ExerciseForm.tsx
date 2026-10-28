import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { addExercise, isExerciseUsed, removeExercise, updateExercise } from '../../db/repository';
import { BODY_PART_LABEL, BODY_PARTS, EXERCISE_TYPE_LABEL, type BodyPart, type Exercise, type ExerciseType } from '../../lib/types';
import s from './manage.module.css';

const TYPES: ExerciseType[] = ['weight', 'bodyweight', 'time'];

export function ExerciseForm({ exercise, onClose }: { exercise: Exercise | null; onClose(): void }) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [bodyPart, setBodyPart] = useState<BodyPart>(exercise?.bodyPart ?? 'chest');
  const [type, setType] = useState<ExerciseType>(exercise?.type ?? 'weight');
  const [restSec, setRestSec] = useState<number | null>(exercise?.restSec ?? 90);
  const [used, setUsed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (exercise) isExerciseUsed(exercise.id).then(setUsed);
  }, [exercise]);

  async function save() {
    if (!name.trim()) return setError('名前を入力してください');
    const data = { name: name.trim(), bodyPart, type, restSec: restSec ?? 90 };
    try {
      if (exercise) await updateExercise(exercise.id, data);
      else await addExercise(data);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    if (!exercise) return;
    const msg = used ? `「${exercise.name}」を一覧から非表示にします（過去の記録は残ります）。よろしいですか？` : `「${exercise.name}」を削除しますか？`;
    if (!window.confirm(msg)) return;
    await removeExercise(exercise.id);
    onClose();
  }

  return (
    <Sheet open title={exercise ? '種目を編集' : '種目を追加'} onClose={onClose}>
      <label className={s.field}>
        <span>名前</span>
        <input className={s.text} aria-label="名前" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={s.field}>
        <span>部位</span>
        <select className={s.select} aria-label="部位" value={bodyPart} onChange={(e) => setBodyPart(e.target.value as BodyPart)}>
          {BODY_PARTS.map((b) => <option key={b} value={b}>{BODY_PART_LABEL[b]}</option>)}
        </select>
      </label>
      <label className={s.field}>
        <span>タイプ{used && '（記録済みのため変更不可）'}</span>
        <select className={s.select} aria-label="タイプ" value={type} disabled={used} onChange={(e) => setType(e.target.value as ExerciseType)}>
          {TYPES.map((t) => <option key={t} value={t}>{EXERCISE_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <label className={s.field}>
        <span>レスト（秒）</span>
        <NumberInput value={restSec} onChange={setRestSec} min={0} max={3600} inputMode="numeric" aria-label="レスト（秒）" />
      </label>
      {error && <p className={s.error}>{error}</p>}
      <div className={s.actions}>
        {exercise && <Button variant="danger" onClick={remove}>削除</Button>}
        <Button variant="primary" onClick={save}>保存</Button>
      </div>
    </Sheet>
  );
}

import { useState } from 'react';
import { Button } from '../../components/Button';
import { useExercises } from '../../hooks/useData';
import { BODY_PART_LABEL, BODY_PARTS, EXERCISE_TYPE_LABEL, type Exercise } from '../../lib/types';
import { ExerciseForm } from './ExerciseForm';
import s from './manage.module.css';

export function ExerciseList() {
  const exercises = useExercises();
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);

  return (
    <>
      <Button block onClick={() => setEditing('new')}>＋ 種目を追加</Button>
      {BODY_PARTS.map((bp) => {
        const items = exercises?.filter((e) => e.bodyPart === bp) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={bp} aria-label={BODY_PART_LABEL[bp]} className={s.group}>
            <h3>{BODY_PART_LABEL[bp]}</h3>
            <div className={s.list}>
              {items.map((e) => (
                <button key={e.id} type="button" className={s.item} onClick={() => setEditing(e)}>
                  <div>
                    <div>{e.name}</div>
                    <div className={s.sub}>{EXERCISE_TYPE_LABEL[e.type]} ・ レスト {e.restSec}秒</div>
                  </div>
                  <span className={s.chev}>›</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {editing && <ExerciseForm exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

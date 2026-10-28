import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { deleteWorkout, finishWorkout, getActiveWorkout, getWorkout, saveWorkout } from '../../db/repository';
import { useElapsed } from '../../hooks/useElapsed';
import { useExerciseMap, useWorkouts } from '../../hooks/useData';
import { toDateKey } from '../../lib/dates';
import { previousEntry } from '../../lib/summary';
import { emptySet, type Workout, type WorkoutSet } from '../../lib/types';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import s from './workout.module.css';

function Elapsed({ startedAt }: { startedAt: number }) {
  return <div className={s.timer}>{useElapsed(startedAt)}</div>;
}

export function WorkoutPage() {
  const { id } = useParams();
  const editMode = !!id;
  const navigate = useNavigate();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [picker, setPicker] = useState(false);
  const all = useWorkouts();
  const exMap = useExerciseMap();

  useEffect(() => {
    let alive = true;
    (editMode ? getWorkout(id!) : getActiveWorkout()).then((x) => alive && setW(x ?? null));
    return () => {
      alive = false;
    };
  }, [editMode, id]);

  if (w === null) return <Navigate to={editMode ? '/calendar' : '/'} replace />;
  if (!w || !exMap || !all) return null;

  const update = (next: Workout) => {
    setW(next);
    saveWorkout(next);
  };
  const setSets = (i: number, sets: WorkoutSet[]) => update({ ...w, entries: w.entries.map((e, j) => (j === i ? { ...e, sets } : e)) });
  const calendarUrl = `/calendar?date=${toDateKey(w.startedAt)}`;

  async function finish() {
    if (!w) return;
    if (editMode) return navigate(calendarUrl);
    if (!window.confirm('ワークアウトを終了しますか？')) return;
    const r = await finishWorkout(w.id);
    if (r === 'saved') return navigate(calendarUrl);
    if (window.confirm('完了したセットがありません。このワークアウトを破棄しますか？')) {
      await deleteWorkout(w.id);
      navigate('/');
    }
  }

  return (
    <div className={s.wrap}>
      <header className={s.head}>
        <div>
          <div className={s.title}>{w.name.toUpperCase()}{editMode && ` ・ ${toDateKey(w.startedAt).replaceAll('-', '/')}`}</div>
          {editMode ? <div className={s.timer}>EDIT</div> : <Elapsed startedAt={w.startedAt} />}
        </div>
        <div className={s.headBtns}>
          <button type="button" className={s.finish} onClick={finish}>{editMode ? '保存' : '終了'}</button>
        </div>
      </header>

      {w.entries.map((e, i) => {
        const ex = exMap.get(e.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={`${e.exerciseId}-${i}`}
            entry={e}
            exercise={ex}
            prev={previousEntry(all, e.exerciseId, { startedAt: w.startedAt, id: w.id })}
            onChange={(sets) => setSets(i, sets)}
            onRemove={() => update({ ...w, entries: w.entries.filter((_, j) => j !== i) })}
          />
        );
      })}

      <button type="button" className={s.addEx} onClick={() => setPicker(true)}>＋ 種目を追加</button>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(exerciseId) => update({ ...w, entries: [...w.entries, { exerciseId, sets: [emptySet()] }] })}
      />
    </div>
  );
}

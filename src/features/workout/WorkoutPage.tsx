import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { deleteWorkout, finishWorkout, getActiveWorkout, getWorkout, saveWorkout } from '../../db/repository';
import { useElapsed } from '../../hooks/useElapsed';
import { useRestTimer } from '../../hooks/useRestTimer';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { isPR } from '../../lib/progress';
import { topSet } from '../../lib/calc';
import { PercentSheet } from '../tools/PercentSheet';
import { PlateSheet } from '../tools/PlateSheet';
import { ConditionSheet } from './ConditionSheet';
import { RestTimerBar } from './RestTimerBar';
import { useExerciseMap, useWorkouts } from '../../hooks/useData';
import { toDateKey } from '../../lib/dates';
import { previousEntry } from '../../lib/summary';
import { emptySet, type Exercise, type Workout, type WorkoutSet } from '../../lib/types';
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
  const [sheet, setSheet] = useState<'condition' | 'memo' | null>(null);
  const [tool, setTool] = useState<{ kind: 'percent' | 'plate'; exercise: Exercise; kg: number } | null>(null);
  const timer = useRestTimer();
  const all = useWorkouts();
  const exMap = useExerciseMap();

  useEffect(() => {
    let alive = true;
    (editMode ? getWorkout(id!) : getActiveWorkout()).then((x) => {
      if (!alive) return;
      setW(x ?? null);
      // 開始直後（1分以内）でコンディション未入力なら入力シートを開く
      const c = x?.condition;
      const age = x ? Date.now() - x.startedAt : Infinity;
      if (!editMode && c && c.sleep == null && c.fatigue == null && c.motivation == null && age >= 0 && age < 60_000) setSheet('condition');
    });
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
  const hasCondition = w.condition.sleep != null || w.condition.fatigue != null || w.condition.motivation != null;
  const lastWeight = (ex: Exercise, sets: WorkoutSet[]) =>
    [...sets].reverse().find((x) => x.weight != null)?.weight ?? topSet(ex.type, previousEntry(all, ex.id, w)?.entry.sets ?? [])?.weight ?? 20;
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
          <button type="button" aria-label="コンディション" className={`${s.icon} ${hasCondition ? s.has : ''}`} onClick={() => setSheet('condition')}>
            <svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
          </button>
          <button type="button" aria-label="ワークアウトメモ" className={`${s.icon} ${w.note ? s.has : ''}`} onClick={() => setSheet('memo')}>
            <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
          </button>
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
            pr={isPR(w, ex, all)}
            onChange={(sets) => setSets(i, sets)}
            onRemove={() => update({ ...w, entries: w.entries.filter((_, j) => j !== i) })}
            onSetDone={editMode ? undefined : () => timer.start(ex.restSec)}
            extraActions={
              ex.type === 'weight'
                ? (close) => (
                    <>
                      <Button block onClick={() => { close(); setTool({ kind: 'percent', exercise: ex, kg: 0 }); }}>%1RM表</Button>
                      <Button block onClick={() => { close(); setTool({ kind: 'plate', exercise: ex, kg: lastWeight(ex, e.sets) }); }}>プレート計算</Button>
                    </>
                  )
                : undefined
            }
          />
        );
      })}

      <button type="button" className={s.addEx} onClick={() => setPicker(true)}>＋ 種目を追加</button>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(exerciseId) => update({ ...w, entries: [...w.entries, { exerciseId, sets: [emptySet()] }] })}
      />
      <ConditionSheet open={sheet === 'condition'} value={w.condition} onChange={(condition) => update({ ...w, condition })} onClose={() => setSheet(null)} />
      <Sheet open={sheet === 'memo'} title="ワークアウトメモ" onClose={() => setSheet(null)}>
        <textarea className={s.textarea} aria-label="ワークアウトのメモ" value={w.note} onChange={(e) => update({ ...w, note: e.target.value })} />
      </Sheet>
      {tool && (
        <PercentSheet
          open={tool.kind === 'percent'}
          exercise={tool.exercise}
          workouts={all}
          onClose={() => setTool(null)}
          onPickWeight={(kg) => setTool({ ...tool, kind: 'plate', kg })}
        />
      )}
      <PlateSheet open={tool?.kind === 'plate'} initialKg={tool?.kg ?? 20} onClose={() => setTool(null)} />
      {!editMode && <RestTimerBar timer={timer} />}
    </div>
  );
}

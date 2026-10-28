import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { deleteWorkout, finishWorkout, getActiveWorkout, getWorkout, saveEditedWorkout, saveWorkout } from '../../db/repository';
import { useElapsed } from '../../hooks/useElapsed';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useWakeLock } from '../../hooks/useWakeLock';
import { unlockSound } from '../../lib/sound';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { isPR } from '../../lib/progress';
import { topSet } from '../../lib/calc';
import { PercentSheet } from '../tools/PercentSheet';
import { PlateSheet } from '../tools/PlateSheet';
import { ConditionSheet } from './ConditionSheet';
import { RestTimerBar } from './RestTimerBar';
import { RestTimerSheet } from './RestTimerSheet';
import { useExerciseMap, useProgram, useSettings, useWorkouts } from '../../hooks/useData';
import { programStatus } from '../../lib/program';
import { entryComplete } from '../../lib/routineEntries';
import { completeSet, placeholderFor } from './workoutOps';
import { toDateKey } from '../../lib/dates';
import { previousEntry } from '../../lib/summary';
import { restOf } from '../../lib/rest';
import { emptySet, type Exercise, type Workout, type WorkoutEntry, type WorkoutSet } from '../../lib/types';
import { ExerciseRow } from './ExerciseRow';
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
  const [sheet, setSheet] = useState<'condition' | 'memo' | 'rest' | null>(null);
  const [tool, setTool] = useState<{ kind: 'percent' | 'plate'; exercise: Exercise; kg: number } | null>(null);
  const timer = useRestTimer();
  const all = useWorkouts();
  const exMap = useExerciseMap();
  const program = useProgram();
  const settings = useSettings();
  /** 開いている種目の index。undefined = まだ決めていない（最初の未完了を開く） */
  const [openIdx, setOpenIdx] = useState<number | null | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  // 記録中は画面を消さず、タップのたびに音を出せる状態にしておく（iPhone はタップ中しか許可されない）
  useWakeLock(!editMode && !!w);
  useEffect(() => {
    if (editMode) return;
    document.addEventListener('pointerdown', unlockSound);
    return () => document.removeEventListener('pointerdown', unlockSound);
  }, [editMode]);

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
  if (!w || !exMap || !all || program === undefined || !settings) return null;

  const update = (next: Workout) => {
    setW(next);
    saveWorkout(next).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  };
  const setEntry = (i: number, entry: WorkoutEntry) => update({ ...w, entries: w.entries.map((e, j) => (j === i ? entry : e)) });
  const firstOpen = Math.max(0, w.entries.findIndex((e) => !entryComplete(e)));
  const open = openIdx === undefined ? (w.entries.length ? firstOpen : null) : openIdx;
  const deload = programStatus(program, toDateKey(w.startedAt)).deload;

  /** 自分でセットするレストタイマーの初期値: 開いている種目のレスト秒数（種目を閉じていれば 90 秒） */
  const openEntry = open != null ? w.entries[open] : undefined;
  const openEx = openEntry && exMap.get(openEntry.exerciseId);
  const manualRestSec = (openEntry && openEx && restOf(openEntry, openEx)) || 90;

  /** 入力のあるセットを完了にして、次の未完了の種目を開く（完了済みなら完了を取り消す） */
  function completeAndNext(i: number) {
    const e = w!.entries[i];
    const ex = exMap!.get(e.exerciseId)!;
    if (entryComplete(e)) {
      setEntry(i, { ...e, sets: e.sets.map((x) => ({ ...x, done: false })) });
      return;
    }
    const prevEntry = previousEntry(all!, e.exerciseId, { startedAt: w!.startedAt, id: w!.id })?.entry ?? null;
    let sets = e.sets;
    sets.forEach((x, k) => {
      // セットの完了ボタンと同じく、空欄は前回の同番号セットで埋める
      if (!x.done && !x.warmup) sets = completeSet(ex.type, sets, k, placeholderFor(prevEntry, sets, k));
    });
    const newlyDone = sets.some((x, k) => x.done && !e.sets[k].done);
    // 何も完了できなかった（入力も前回値もない）ときは閉じずにそのまま
    if (!newlyDone) return;
    const next = { ...e, sets };
    setEntry(i, next);
    if (!editMode) timer.start(restOf(e, ex));
    const entries = w!.entries.map((x, j) => (j === i ? next : x));
    // 後ろの未完了 → 無ければ前に戻って最初の未完了
    const order = [...entries.keys()].filter((j) => j > i).concat([...entries.keys()].filter((j) => j < i));
    const after = order.find((j) => !entryComplete(entries[j]));
    setOpenIdx(after ?? null);
  }
  const hasCondition = w.condition.sleep != null || w.condition.fatigue != null || w.condition.motivation != null;
  const lastWeight = (ex: Exercise, sets: WorkoutSet[]) =>
    [...sets].reverse().find((x) => x.weight != null)?.weight ?? topSet(ex.type, previousEntry(all, ex.id, w)?.entry.sets ?? [])?.weight ?? 20;
  const calendarUrl = `/calendar?date=${toDateKey(w.startedAt)}`;

  async function finish() {
    if (!w) return;
    if (!editMode && !window.confirm('ワークアウトを終了しますか？')) return;
    const r = editMode ? await saveEditedWorkout(w.id) : await finishWorkout(w.id);
    // 終了したらレストも止める（次のワークアウトに持ち越さない）
    if (!editMode && r === 'saved') timer.skip();
    if (r === 'saved') return navigate(calendarUrl);
    if (window.confirm('完了したセットがありません。このワークアウトを破棄しますか？')) {
      await deleteWorkout(w.id);
      timer.skip();
      navigate(editMode ? calendarUrl : '/');
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
          {!editMode && (
            <button type="button" aria-label="レストタイマー" className={`${s.icon} ${timer.running ? s.has : ''}`} onClick={() => setSheet('rest')}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2h5M12 2v3" /></svg>
            </button>
          )}
          <button type="button" aria-label="コンディション" className={`${s.icon} ${hasCondition ? s.has : ''}`} onClick={() => setSheet('condition')}>
            <svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
          </button>
          <button type="button" aria-label="ワークアウトメモ" className={`${s.icon} ${w.note ? s.has : ''}`} onClick={() => setSheet('memo')}>
            <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
          </button>
          <button type="button" className={s.finish} onClick={finish}>{editMode ? '保存' : '終了'}</button>
        </div>
      </header>
      {saveFailed && (
        <p role="alert" className={s.saveError}>保存できませんでした。端末の空き容量を確認してください。入力を続けると再度保存します。</p>
      )}

      {w.entries.map((e, i) => {
        const ex = exMap.get(e.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseRow
            key={`${e.exerciseId}-${i}`}
            index={i}
            entry={e}
            exercise={ex}
            prev={previousEntry(all, e.exerciseId, { startedAt: w.startedAt, id: w.id })}
            open={open === i}
            onToggle={() => setOpenIdx(open === i ? null : i)}
            pr={isPR(w, ex, all)}
            deload={deload}
            plates={settings.plates}
            onChange={(entry) => setEntry(i, entry)}
            onRemove={() => {
              update({ ...w, entries: w.entries.filter((_, j) => j !== i) });
              setOpenIdx(open === i ? null : open != null && open > i ? open - 1 : open);
            }}
            onSetDone={editMode ? undefined : () => timer.start(restOf(e, ex))}
            onCompleteAndNext={() => completeAndNext(i)}
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
        onPick={(exerciseId) => {
          update({ ...w, entries: [...w.entries, { exerciseId, sets: [emptySet()] }] });
          setOpenIdx(w.entries.length);
        }}
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
      <RestTimerSheet open={sheet === 'rest'} initialSec={manualRestSec} onStart={timer.start} onClose={() => setSheet(null)} />
    </div>
  );
}

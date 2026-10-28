import { useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { formatSet, topSet } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from '../../lib/types';
import { SetRow } from './SetRow';
import { addSet, completeSet, placeholderFor, removeSet, toggleWarmup, updateSet, workingNumber } from './workoutOps';
import s from './workout.module.css';

type Props = {
  entry: WorkoutEntry;
  exercise: Exercise;
  prev: { workout: Workout; entry: WorkoutEntry } | null;
  pr?: boolean;
  onChange(sets: WorkoutSet[]): void;
  onRemove(): void;
  onSetDone?(): void;
  extraActions?(close: () => void): React.ReactNode;
};

const INPUT_HEAD = { weight: ['KG', 'REP'], bodyweight: ['+KG', 'REP'], time: ['秒'] } as const;

export function ExerciseCard({ entry, exercise, prev, pr, onChange, onRemove, onSetDone, extraActions }: Props) {
  const [menu, setMenu] = useState(false);
  const [noteIdx, setNoteIdx] = useState<number | null>(null);
  const sets = entry.sets;
  const prevTop = prev && topSet(exercise.type, prev.entry.sets);

  function toggleDone(i: number) {
    const next = completeSet(exercise.type, sets, i, placeholderFor(prev?.entry ?? null, sets, i));
    if (next === sets) return;
    onChange(next);
    if (next[i].done) onSetDone?.();
  }

  return (
    <section aria-label={exercise.name} className={s.card}>
      <div className={s.cardHead}>
        <div>
          <div className={s.exName}>
            {exercise.name}
            {pr && <span className={s.pr}>PR</span>}
          </div>
          <div className={s.prev}>
            {prev && prevTop ? `前回 ${formatMD(prev.workout.startedAt)} ・ ${formatSet(exercise.type, prevTop)}` : '前回の記録なし'}
          </div>
        </div>
        <button type="button" className={s.menu} aria-label="メニュー" onClick={() => setMenu(true)}>⋯</button>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.colSet}>SET</th>
            <th className={s.colPrev}>前回</th>
            {INPUT_HEAD[exercise.type].map((h) => <th key={h} colSpan={exercise.type === 'time' ? 2 : 1}>{h}</th>)}
            <th>RPE</th>
            <th className={s.colNote} />
            <th className={s.colCheck} />
          </tr>
        </thead>
        <tbody>
          {sets.map((set, i) => (
            <SetRow
              key={i}
              type={exercise.type}
              set={set}
              number={workingNumber(sets, i)}
              placeholder={placeholderFor(prev?.entry ?? null, sets, i)}
              onChange={(patch) => onChange(updateSet(sets, i, patch))}
              onToggleWarmup={() => onChange(toggleWarmup(sets, i))}
              onToggleDone={() => toggleDone(i)}
              onNote={() => setNoteIdx(i)}
            />
          ))}
        </tbody>
      </table>
      <button type="button" className={s.add} onClick={() => onChange(addSet(sets))}>＋ セット追加</button>

      <Sheet open={menu} title={exercise.name} onClose={() => setMenu(false)}>
        <div className={s.actions}>
          {extraActions?.(() => setMenu(false))}
          <Button block disabled={sets.length === 0} onClick={() => { onChange(removeSet(sets, sets.length - 1)); setMenu(false); }}>
            最後のセットを削除
          </Button>
          <Button block variant="danger" onClick={() => { if (window.confirm(`「${exercise.name}」をこのワークアウトから削除しますか？`)) { setMenu(false); onRemove(); } }}>
            種目を削除
          </Button>
        </div>
      </Sheet>

      <Sheet open={noteIdx !== null} title="セットのメモ" onClose={() => setNoteIdx(null)}>
        {noteIdx !== null && sets[noteIdx] && (
          <textarea
            className={s.textarea}
            aria-label="セットのメモ"
            autoFocus
            value={sets[noteIdx].note}
            onChange={(e) => onChange(updateSet(sets, noteIdx, { note: e.target.value }))}
          />
        )}
      </Sheet>
    </section>
  );
}

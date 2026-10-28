import { useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { formatDuration, formatSet, isWorking, topSet } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { entryComplete } from '../../lib/routineEntries';
import { deloadSets } from '../../lib/program';
import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from '../../lib/types';
import { SetCard } from './SetCard';
import { restOf } from '../../lib/rest';
import { SuggestionBlock } from './SuggestionBlock';
import { addSet, completeSet, placeholderFor, removeSet, toggleWarmup, updateSet, workingNumber } from './workoutOps';
import s from './workout.module.css';

type Props = {
  index: number;
  entry: WorkoutEntry;
  exercise: Exercise;
  prev: { workout: Workout; entry: WorkoutEntry } | null;
  open: boolean;
  onToggle(): void;
  pr: boolean;
  deload: boolean;
  plates: number[];
  onChange(entry: WorkoutEntry): void;
  onRemove(): void;
  onSetDone?(): void;
  onCompleteAndNext(): void;
  extraActions?(close: () => void): ReactNode;
};

export function ExerciseRow({ index, entry, exercise, prev, open, onToggle, pr, deload, plates, onChange, onRemove, onSetDone, onCompleteAndNext, extraActions }: Props) {
  const [menu, setMenu] = useState(false);
  const [noteIdx, setNoteIdx] = useState<number | null>(null);
  const sets = entry.sets;
  const done = entryComplete(entry);
  const prevTop = prev && topSet(exercise.type, prev.entry.sets);
  const prevWorking = prev?.entry.sets.filter(isWorking) ?? [];
  const setSets = (next: WorkoutSet[]) => onChange({ ...entry, sets: next });
  const rest = `レスト ${formatDuration(restOf(entry, exercise))}`;

  function toggleDone(i: number) {
    const next = completeSet(exercise.type, sets, i, placeholderFor(prev?.entry ?? null, sets, i));
    if (next === sets) return;
    setSets(next);
    if (next[i].done) onSetDone?.();
  }

  return (
    <section aria-label={exercise.name} className={`${s.row} ${open ? s.open : ''}`}>
      <button type="button" className={s.rowHead} aria-expanded={open} onClick={onToggle}>
        <span className={`${s.badge} ${done ? s.ok : ''}`} aria-label={done ? '種目完了' : undefined}>
          {done ? <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg> : index + 1}
        </span>
        <span className={s.headText}>
          <span className={s.exName}>
            {exercise.name}
            {entry.target?.main && <span className={s.mainTag}>メイン</span>}
            {pr && <span className={s.pr}>PR</span>}
          </span>
          <span className={s.sub} style={{ display: 'block' }}>{entry.target ? `${deloadSets(entry.target.sets, deload)}セット×${entry.target.reps} ・ ${rest}` : rest}</span>
          <span className={s.prev} style={{ display: 'block' }}>
            {prev && prevTop ? `前回 ${formatMD(prev.workout.startedAt)} ・ ${formatSet(exercise.type, prevTop)}` : '前回の記録なし'}
          </span>
        </span>
      </button>

      {open && (
        <div className={s.panel}>
          <div className={s.panelTop}>
            <button type="button" className={s.menu} aria-label="メニュー" onClick={() => setMenu(true)}>⋯</button>
          </div>
          {entry.target && <SuggestionBlock exercise={exercise} target={entry.target} prev={prev} deload={deload} plates={plates} />}
          <div className={s.sets}>
            {sets.map((set, i) => {
              const n = workingNumber(sets, i);
              return (
                <SetCard
                  key={i}
                  type={exercise.type}
                  set={set}
                  number={n}
                  prevSet={n != null ? prevWorking[n - 1] ?? null : null}
                  placeholder={placeholderFor(prev?.entry ?? null, sets, i)}
                  weightStep={entry.target?.inc ?? 2.5}
                  canRemove={sets.length > 1}
                  onChange={(patch) => setSets(updateSet(sets, i, patch))}
                  onToggleWarmup={() => setSets(toggleWarmup(sets, i))}
                  onToggleDone={() => toggleDone(i)}
                  onRemove={() => setSets(removeSet(sets, i))}
                  onNote={() => setNoteIdx(i)}
                />
              );
            })}
          </div>
          <div className={s.btnRow}>
            <button type="button" onClick={() => setSets(addSet(sets))}>＋ セット追加</button>
            {entry.target?.main && (
              <button type="button" aria-pressed={!!entry.slowed} onClick={() => onChange({ ...entry, slowed: !entry.slowed })}>
                最後の回でスピードが落ちた
              </button>
            )}
            <button type="button" className={s.next} onClick={onCompleteAndNext}>{done ? '完了を取り消す' : 'この種目を完了して次へ'}</button>
          </div>
        </div>
      )}

      <Sheet open={menu} title={exercise.name} onClose={() => setMenu(false)}>
        <div className={s.actions}>
          {extraActions?.(() => setMenu(false))}
          <Button block variant="danger" onClick={() => { if (window.confirm(`「${exercise.name}」をこのワークアウトから削除しますか？`)) { setMenu(false); onRemove(); } }}>
            種目を削除
          </Button>
        </div>
      </Sheet>

      <Sheet open={noteIdx !== null} title="セットのメモ" onClose={() => setNoteIdx(null)}>
        {noteIdx !== null && sets[noteIdx] && (
          <textarea className={s.textarea} aria-label="セットのメモ" autoFocus value={sets[noteIdx].note} onChange={(e) => setSets(updateSet(sets, noteIdx, { note: e.target.value }))} />
        )}
      </Sheet>
    </section>
  );
}

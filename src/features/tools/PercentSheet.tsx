import { Sheet } from '../../components/Sheet';
import { estimate1RM, formatKg } from '../../lib/calc';
import { personalBest } from '../../lib/progress';
import { percentTable } from '../../lib/tools';
import type { Exercise, Workout } from '../../lib/types';
import s from './tools.module.css';

type Props = { open: boolean; onClose(): void; exercise: Exercise; workouts: Workout[]; onPickWeight?(kg: number): void };

export function PercentTable({ oneRM, onPickWeight }: { oneRM: number; onPickWeight?(kg: number): void }) {
  return (
    <div className={s.rows}>
      {percentTable(oneRM).map((r) => (
        <button key={r.percent} type="button" className={`${s.row} ${r.percent === 80 ? s.hl : ''}`} onClick={() => onPickWeight?.(r.kg)}>
          <span className={s.pct}>{r.percent}%</span>
          <span>{formatKg(r.kg)}kg</span>
        </button>
      ))}
    </div>
  );
}

export function PercentSheet({ open, onClose, exercise, workouts, onPickWeight }: Props) {
  const best = personalBest(workouts, exercise);
  const oneRM = best ? estimate1RM(best.set.weight, best.set.reps) : 0;
  return (
    <Sheet open={open} title={`%1RM ・ ${exercise.name}`} onClose={onClose}>
      {oneRM > 0 ? (
        <>
          <div className={s.base}>
            <span className="muted" style={{ fontSize: 12 }}>推定1RM（自己ベスト）</span>
            <span className="num">{formatKg(Math.round(oneRM * 10) / 10)}kg</span>
          </div>
          <PercentTable oneRM={oneRM} onPickWeight={onPickWeight} />
        </>
      ) : (
        <p className="muted" style={{ textAlign: 'center', padding: 24 }}>記録がありません</p>
      )}
    </Sheet>
  );
}

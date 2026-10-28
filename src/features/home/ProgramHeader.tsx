import type { programStatus } from '../../lib/program';
import { isDeload, PROGRAM_WEEKS } from '../../lib/program';
import s from './home.module.css';

export function ProgramHeader({ status }: { status: ReturnType<typeof programStatus> }) {
  if (!status.active) return null;
  return (
    <section aria-label="プログラム" className={s.prog}>
      {status.inRange ? (
        <div className={s.weekNum}>
          <span>{status.week}</span>
          <small>週目 / 8</small>
        </div>
      ) : (
        <div className={s.weekOff}>{status.label}</div>
      )}
      <div className={s.segs} aria-hidden="true">
        {Array.from({ length: PROGRAM_WEEKS }, (_, i) => {
          const n = i + 1;
          const state = n < status.week ? 'done' : n === status.week ? 'now' : 'future';
          return <i key={n} data-state={state} data-deload={isDeload(n) ? '' : undefined} />;
        })}
      </div>
      {status.inRange && status.label && <div className={s.segLabel}>{status.label}</div>}
      {status.week > PROGRAM_WEEKS && <div className={s.segLabel}>グラフ › 8週間テストで結果を入力しましょう</div>}
    </section>
  );
}

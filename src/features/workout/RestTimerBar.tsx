import type { useRestTimer } from '../../hooks/useRestTimer';
import s from './rest.module.css';

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.running) return null;
  const pct = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0;
  return (
    <div className={s.rest} role="timer">
      <div>
        <div className={s.label}>REST</div>
        <div className={s.time}>{mmss(timer.remaining)}</div>
        <div className={s.bar}><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={s.btns}>
        <button type="button" onClick={() => timer.add(-15)}>-15s</button>
        <button type="button" onClick={() => timer.add(15)}>+15s</button>
        <button type="button" onClick={timer.skip}>スキップ</button>
      </div>
    </div>
  );
}

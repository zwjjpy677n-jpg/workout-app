import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { startRoutineWorkout } from '../../db/repository';
import { toDateKey } from '../../lib/dates';
import { deloadSets, type programStatus } from '../../lib/program';
import { entryComplete } from '../../lib/routineEntries';
import { WEEKDAY_LABEL, type Routine, type Workout } from '../../lib/types';
import s from './home.module.css';

type Props = {
  routines: Routine[];
  workouts: Workout[];
  active: Workout | null;
  status: ReturnType<typeof programStatus>;
  now: number;
};

export function TodayCard({ routines, workouts, active, status, now }: Props) {
  const navigate = useNavigate();
  const dow = new Date(now).getDay();
  const today = routines.find((r) => r.weekday === dow);
  const todayKey = toDateKey(now);

  if (!today) {
    let next: { r: Routine; wd: number } | null = null;
    for (let i = 1; i <= 7 && !next; i++) {
      const wd = (dow + i) % 7;
      const r = routines.find((x) => x.weekday === wd);
      if (r) next = { r, wd };
    }
    return (
      <section aria-label="今日は休み" className={s.today}>
        <div className={s.todaySub}>今日のトレーニング</div>
        <div className={s.todayName}>今日は休み</div>
        {next && <div className={s.todaySub}>次は{WEEKDAY_LABEL[next.wd]}曜 {next.r.name}</div>}
      </section>
    );
  }

  const mine = active?.routineId === today.id ? active : null;
  const doneToday = workouts.find((w) => w.endedAt !== null && w.routineId === today.id && toDateKey(w.startedAt) === todayKey);
  const ref = mine ?? doneToday;
  const doneCount = ref ? ref.entries.filter(entryComplete).length : 0;
  // 記録中・記録済みなら実際の種目数（追加した種目も含む）で数える
  const total = ref ? ref.entries.length : today.items.length;
  const sets = today.items.reduce((a, i) => a + deloadSets(i.sets, status.deload), 0);
  const otherActive = !!active && !mine;

  return (
    <section aria-label="今日のトレーニング" className={s.today}>
      <div className={s.todayTop}>
        {status.inRange ? <span className={s.pill}>{status.week}週目 / 8{status.deload ? ' ・ 回復週' : ''}</span> : <span className={s.todaySub}>今日のトレーニング</span>}
        <span className={s.todaySub}>進捗 {doneCount} / {total}</span>
      </div>
      <div className={s.todayName}>{today.name}</div>
      <div className={s.todaySub}>{today.items.length}種目 ・ {sets}セット</div>
      <div className={s.pbar}><i style={{ width: `${(100 * doneCount) / Math.max(1, total)}%` }} /></div>
      {!otherActive &&
        (mine ? (
          <Button block variant="primary" onClick={() => navigate('/workout')}>続きを記録する</Button>
        ) : doneToday ? (
          <Button block onClick={() => navigate(`/calendar?date=${todayKey}`)}>記録を見直す</Button>
        ) : (
          <Button
            block
            variant="primary"
            onClick={async () => {
              await startRoutineWorkout(today.id);
              navigate('/workout');
            }}
          >
            トレーニングを始める
          </Button>
        ))}
    </section>
  );
}

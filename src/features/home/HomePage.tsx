import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Stat } from '../../components/Stat';
import { startRoutineWorkout, startWorkout } from '../../db/repository';
import { useActiveWorkout, useExerciseMap, useProgram, useRoutines, useWorkouts } from '../../hooks/useData';
import { programStatus } from '../../lib/program';
import { useToday } from '../../hooks/useToday';
import { ProgramHeader } from './ProgramHeader';
import { TodayCard } from './TodayCard';
import { volumeParts } from '../../lib/calc';
import { formatMDW, toDateKey } from '../../lib/dates';
import { completed, weekSummary, weeklySetsByBodyPart, workoutVolume } from '../../lib/summary';
import { BodyPartBars } from './BodyPartBars';
import { BodyweightCard } from './BodyweightCard';
import s from './home.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const routines = useRoutines();
  const workouts = useWorkouts();
  const exMap = useExerciseMap();
  const program = useProgram();
  const now = useToday();
  const status = programStatus(program ?? null, toDateKey(now));

  async function startFree() {
    await startWorkout({ name: 'Workout', exerciseIds: [] });
    navigate('/workout');
  }

  async function startRoutine(id: string) {
    if (active) {
      if (window.confirm(`記録中のワークアウト「${active.name}」があります。先にそちらを終了してください。記録中のワークアウトを開きますか？`)) navigate('/workout');
      return;
    }
    await startRoutineWorkout(id);
    navigate('/workout');
  }

  const todayRoutine = routines?.find((r) => r.weekday === new Date(now).getDay());
  const showResume = !!active && active.routineId !== (todayRoutine?.id ?? '__none');

  const week = workouts && exMap ? weekSummary(workouts, exMap, now) : null;
  const vol = volumeParts(week?.volume ?? 0);
  const recent = workouts ? completed(workouts).slice(-3).reverse() : [];

  return (
    <div className="page">
      <div className={s.top}>
        <div className={s.brand}>IRON<span>LOG</span></div>
        <div className={s.date}>{formatMDW(now)}</div>
      </div>

      <ProgramHeader status={status} />

      {showResume && (
        <div style={{ marginBottom: 12 }}>
          <Button block variant="primary" onClick={() => navigate('/workout')}>RESUME WORKOUT</Button>
        </div>
      )}
      {routines && workouts && active !== undefined && (
        <TodayCard routines={routines} workouts={workouts} active={active} status={status} now={now} />
      )}
      {active === null && (
        <Button block onClick={startFree}>自由に記録する</Button>
      )}

      <BodyweightCard />

      <div className="sec">This Week</div>
      <div className={s.stats}>
        <Stat value={String(week?.days ?? 0)} unit="日" label="トレーニング日数" />
        <Stat value={vol.value} unit={vol.unit} label="総ボリューム" />
      </div>

      {routines && routines.length > 0 && (
        <>
          <div className="sec">Routines</div>
          <div className={s.routines}>
            {routines.map((r) => (
              <button key={r.id} type="button" className={s.routine} onClick={() => startRoutine(r.id)}>
                <b>{r.name}</b>
                <span>{r.items.length}種目</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sec">Sets / Body Part（今週）</div>
      <Card>{workouts && exMap && <BodyPartBars counts={weeklySetsByBodyPart(workouts, exMap, now)} />}</Card>

      <div className="sec">Recent</div>
      <section aria-label="最近のワークアウト" className={s.recent}>
        {recent.length === 0 && <p className={s.empty}>まだ記録がありません。今日のトレーニングか「自由に記録する」から始めましょう。</p>}
        {recent.map((w) => {
          const v = volumeParts(exMap ? workoutVolume(w, exMap) : 0);
          return (
            <Card key={w.id} onClick={() => navigate(`/calendar?date=${toDateKey(w.startedAt)}`)}>
              <div className={s.rRow}>
                <div>
                  <div className={s.rDate}>{formatMDW(w.startedAt)}</div>
                  <div className={s.rName}>{w.name}</div>
                </div>
                <div className={s.rVol}>{v.value}<small>{v.unit}</small></div>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

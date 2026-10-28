import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Stat } from '../../components/Stat';
import { startWorkout } from '../../db/repository';
import { useActiveWorkout, useExerciseMap, useRoutines, useWorkouts } from '../../hooks/useData';
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
  const now = Date.now();

  async function start(name: string, exerciseIds: string[]) {
    await startWorkout({ name, exerciseIds });
    navigate('/workout');
  }

  const week = workouts && exMap ? weekSummary(workouts, exMap, now) : null;
  const vol = volumeParts(week?.volume ?? 0);
  const recent = workouts ? completed(workouts).slice(-3).reverse() : [];

  return (
    <div className="page">
      <div className={s.top}>
        <div className={s.brand}>IRON<span>LOG</span></div>
        <div className={s.date}>{formatMDW(now)}</div>
      </div>

      {active === undefined ? (
        <Button block variant="primary" disabled>…</Button>
      ) : active ? (
        <Button block variant="primary" onClick={() => navigate('/workout')}>RESUME WORKOUT</Button>
      ) : (
        <Button block variant="primary" onClick={() => start('Workout', [])}>START WORKOUT</Button>
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
              <button key={r.id} type="button" className={s.routine} onClick={() => start(r.name, r.exerciseIds)}>
                <b>{r.name}</b>
                <span>{r.exerciseIds.length}種目</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sec">Sets / Body Part（今週）</div>
      <Card>{workouts && exMap && <BodyPartBars counts={weeklySetsByBodyPart(workouts, exMap, now)} />}</Card>

      <div className="sec">Recent</div>
      <section aria-label="最近のワークアウト" className={s.recent}>
        {recent.length === 0 && <p className={s.empty}>まだ記録がありません。START WORKOUT から始めましょう。</p>}
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

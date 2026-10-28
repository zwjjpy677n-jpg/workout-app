import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { useFriend, useFriendWorkouts } from '../../hooks/useData';
import { formatSet, isWorking } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { METRICS, progressSeries, RANGES, type Metric, type Range } from '../../lib/progress';
import { summarizeSets } from '../calendar/summarizeSets';
import { FORMATS } from '../progress/formats';
import { ProgressChart } from '../progress/ProgressChart';
import p from '../progress/progress.module.css';
import s from './friends.module.css';

export function FriendExercisePage() {
  const { id = '', x8 = '' } = useParams();
  const navigate = useNavigate();
  const friend = useFriend(id);
  const workouts = useFriendWorkouts(id);
  const [range, setRange] = useState<Range>('3M');
  const [metric, setMetric] = useState<Metric>('e1rm');

  if (friend === null) return <Navigate to="/friends" replace />;
  if (!friend || !workouts) return null;
  const exercise = friend.exercises.find((e) => e.id === `${id}:${x8}`);
  if (!exercise) return <Navigate to="/friends" replace />;

  const metrics = METRICS[exercise.type];
  const active = metrics.find((m) => m.key === metric)?.key ?? metrics[0].key;
  const data = progressSeries(workouts, exercise, active, range, Date.now());
  const fmt = FORMATS[active];
  const last = data.at(-1);
  const pr = friend.prs.find((x) => x.exerciseId === exercise.id);
  const recent = workouts
    .map((w) => ({ w, sets: w.entries.filter((e) => e.exerciseId === exercise.id).flatMap((e) => e.sets.filter(isWorking)) }))
    .filter((x) => x.sets.length > 0)
    .slice(0, 5);

  return (
    <div className="page">
      <button type="button" className={s.back} onClick={() => navigate(`/friends/${id}`)}>‹ {friend.name}</button>
      <h1 className={s.friendName}>{`${friend.name}さん ・ ${exercise.name}`}</h1>
      <div className={p.seg}>
        {RANGES.map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
      </div>
      <div className={p.metricLabel}>{metrics.find((m) => m.key === active)?.label}</div>
      <div className={p.hero}>
        <div className={p.big} aria-label="今の値">{last ? fmt.value(last.value) : '–'}{last && fmt.unit && <small>{fmt.unit}</small>}</div>
      </div>
      {data.length >= 2 ? <ProgressChart data={data} format={(v) => fmt.value(v) + fmt.unit} /> : <div className={p.empty}>記録が増えるとグラフが表示されます</div>}
      <div className={p.metrics} role="group" aria-label="指標">
        {metrics.map((m) => <button key={m.key} type="button" aria-pressed={active === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>)}
      </div>
      {pr && (
        <Card className={p.pb}>
          <span>自己ベスト</span>
          <span>{formatSet(exercise.type, pr.set)}</span>
        </Card>
      )}
      <ul aria-label="直近の記録" className={s.recent}>
        {recent.map(({ w, sets }) => (
          <li key={w.id} className={s.entry}>
            <span>{formatMD(w.startedAt)}</span>
            <span className="num">{summarizeSets(exercise.type, sets)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

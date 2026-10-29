import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { useFriend, useFriendWorkouts } from '../../hooks/useData';
import { formatMD, formatMDW } from '../../lib/dates';
import { METRICS, progressSeries, RANGES, type Metric, type Range } from '../../lib/progress';
import { menuTitle } from '../../lib/share/menuPayload';
import type { Exercise, Routine } from '../../lib/types';
import { summarizeSets } from '../calendar/summarizeSets';
import { FORMATS } from '../progress/formats';
import { ProgressChart } from '../progress/ProgressChart';
import p from '../progress/progress.module.css';
import s from './friends.module.css';

function MenuItems({ menu, exName }: { menu: Routine; exName: Map<string, string> }) {
  return (
    <>
      {menu.items.map((it, i) => (
        <div key={i} className={s.entry}>
          <span>
            {exName.get(it.exerciseId)}
            {it.main && <em className={s.main}>メイン</em>}
          </span>
          <span className="num">{`${it.sets}セット×${it.reps}`}</span>
        </div>
      ))}
    </>
  );
}

/** 友達が共有したメニュー1つ: 最新の版・前の版・そのメニューでやった記録・種目ごとのグラフ */
export function FriendMenuPage() {
  const { id = '', name = '' } = useParams();
  const navigate = useNavigate();
  const friend = useFriend(id);
  const workouts = useFriendWorkouts(id);
  const [pick, setPick] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('3M');
  const [metric, setMetric] = useState<Metric>('e1rm');

  if (friend === null) return <Navigate to="/friends" replace />;
  if (!friend || !workouts) return null;
  const menu = friend.routines.find((r) => r.name === name);
  if (!menu) return <Navigate to={`/friends/${id}?tab=menus`} replace />;

  const exById = new Map(friend.exercises.map((e) => [e.id, e]));
  const exName = new Map(friend.exercises.map((e) => [e.id, e.name]));
  const older = (friend.menuHistory ?? []).filter((r) => r.name === name);
  // メニューから始めた記録はメニューと同じ名前になる
  const done = workouts.filter((w) => w.name === name);
  const menuExercises = [...new Set(menu.items.map((it) => it.exerciseId))].map((x) => exById.get(x)).filter((e): e is Exercise => !!e);
  const exercise = menuExercises.find((e) => e.id === pick) ?? menuExercises[0];
  const metrics = exercise ? METRICS[exercise.type] : [];
  const active = metrics.find((m) => m.key === metric)?.key ?? metrics[0]?.key;
  const data = exercise && active ? progressSeries(done, exercise, active, range, Date.now()) : [];
  const fmt = active ? FORMATS[active] : null;
  const last = data.at(-1);

  return (
    <div className="page">
      <button type="button" className={s.back} onClick={() => navigate(`/friends/${id}?tab=menus`)}>‹ {friend.name}</button>
      <h1 className={s.friendName}>{`${friend.name}さん ・ ${menuTitle(menu.name, menu.weekday)}`}</h1>
      <p className={s.sub}>{`受け取り ${formatMD(menu.createdAt)}`}</p>
      <Card className={s.menu}>
        <MenuItems menu={menu} exName={exName} />
      </Card>

      {older.length > 0 && (
        <section aria-label="前の版" className={s.week}>
          <h2 className={s.weekHead}>前の版</h2>
          {older.map((r, i) => (
            <details key={i} className={s.olderMenu}>
              <summary>{`${formatMD(r.createdAt)} 受け取り ・ ${menuTitle(r.name, r.weekday)}`}</summary>
              <MenuItems menu={r} exName={exName} />
            </details>
          ))}
        </section>
      )}

      {exercise && fmt && (
        <section className={s.week}>
          <h2 className={s.weekHead}>グラフ</h2>
          <div className={s.pickList}>
            {menuExercises.map((e) => (
              <button key={e.id} type="button" className={s.pick} aria-pressed={e.id === exercise.id} onClick={() => setPick(e.id)}>{e.name}</button>
            ))}
          </div>
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
        </section>
      )}

      <section className={s.week}>
        <h2 className={s.weekHead}>このメニューの記録</h2>
        {done.length === 0 && <p className={s.empty}>このメニューの記録はまだありません</p>}
        <ul aria-label="このメニューの記録" className={s.recent}>
          {done.map((w) => (
            <li key={w.id}>
              <Card>
                <div className={s.day}>{formatMDW(w.startedAt)}</div>
                {w.entries.map((e, i) => {
                  const ex = exById.get(e.exerciseId);
                  return ex ? (
                    <div key={i} className={s.entry}>
                      <span>{ex.name}</span>
                      <span className="num">{summarizeSets(ex.type, e.sets)}</span>
                    </div>
                  ) : null;
                })}
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

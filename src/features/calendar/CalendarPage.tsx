import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Stat } from '../../components/Stat';
import { useBodyweights, useExerciseMap, useWorkouts } from '../../hooks/useData';
import { volumeParts } from '../../lib/calc';
import { fromDateKey, toDateKey } from '../../lib/dates';
import { monthSummary } from '../../lib/summary';
import { DayDetail } from './DayDetail';
import { MonthGrid } from './MonthGrid';
import s from './calendar.module.css';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function CalendarPage() {
  const [params] = useSearchParams();
  const initial = params.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('date')!) ? params.get('date')! : toDateKey(Date.now());
  const [selected, setSelected] = useState(initial);
  const [ym, setYm] = useState(() => {
    const d = fromDateKey(initial);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const workouts = useWorkouts();
  const bodyweights = useBodyweights();
  const exMap = useExerciseMap();

  const shift = (dir: number) => setYm(({ y, m }) => {
    const d = new Date(y, m + dir, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const goToday = () => {
    const now = new Date();
    setYm({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(toDateKey(now.getTime()));
  };

  const sum = workouts && exMap ? monthSummary(workouts, exMap, ym.y, ym.m) : { days: 0, volume: 0, byDay: {} };
  const vol = volumeParts(sum.volume);

  return (
    <div className="page">
      <div className={s.head}>
        <button type="button" className={s.arrow} aria-label="前の月" onClick={() => shift(-1)}>‹</button>
        <div className={s.month}>{MONTHS[ym.m]} {ym.y}</div>
        <button type="button" className={s.arrow} aria-label="次の月" onClick={() => shift(1)}>›</button>
        <button type="button" className={s.today} onClick={goToday}>今日</button>
      </div>
      <div className={s.sum}>
        <Stat value={String(sum.days)} unit="日" label="トレーニング日数" />
        <Stat value={vol.value} unit={vol.unit} label="総ボリューム" />
      </div>
      <MonthGrid year={ym.y} month0={ym.m} byDay={sum.byDay} selected={selected} onSelect={setSelected} onSwipe={shift} />
      <div className={s.legend} aria-hidden="true">
        少 <i style={{ background: 'rgb(var(--red-rgb) / .22)' }} /><i style={{ background: 'rgb(var(--red-rgb) / .45)' }} /><i style={{ background: 'rgb(var(--red-rgb) / .8)' }} /> 多
      </div>
      {workouts && bodyweights && exMap && <DayDetail dateKey={selected} workouts={workouts} bodyweights={bodyweights} exercises={exMap} />}
    </div>
  );
}

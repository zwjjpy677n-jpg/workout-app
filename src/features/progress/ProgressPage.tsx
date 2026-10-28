import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { useBodyweights, useExercises, useWorkouts } from '../../hooks/useData';
import { estimate1RM, formatDuration, formatKg, formatSet, formatVolume, isWorking } from '../../lib/calc';
import { bodyweightSeries, METRICS, personalBest, progressSeries, RANGES, type Metric, type Range } from '../../lib/progress';
import { completed } from '../../lib/summary';
import { PercentTable } from '../tools/PercentSheet';
import { PlateSheet } from '../tools/PlateSheet';
import { ProgressChart } from './ProgressChart';
import s from './progress.module.css';

const BW = '__bodyweight';
type Fmt = { value(v: number): string; unit: string; delta(v: number): string };

const kg1 = (v: number) => formatKg(Math.round(v * 10) / 10);
const FORMATS: Record<Metric | 'bw', Fmt> = {
  e1rm: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  maxWeight: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  maxAdded: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  bw: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  volume: { value: formatVolume, unit: '', delta: formatVolume },
  totalReps: { value: String, unit: '回', delta: (v) => `${v}回` },
  maxTime: { value: formatDuration, unit: '', delta: formatDuration },
  totalTime: { value: formatDuration, unit: '', delta: formatDuration },
};

export function ProgressPage() {
  const workouts = useWorkouts();
  const exercises = useExercises(true);
  const logs = useBodyweights();
  const [target, setTarget] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('3M');
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [plateKg, setPlateKg] = useState<number | null>(null);
  const now = Date.now();

  const recorded = useMemo(() => {
    if (!workouts || !exercises) return [];
    const used = new Set(completed(workouts).flatMap((w) => w.entries.filter((e) => e.sets.some(isWorking)).map((e) => e.exerciseId)));
    return exercises.filter((e) => used.has(e.id));
  }, [workouts, exercises]);

  if (!workouts || !exercises || !logs) return <div className="page"><h1 className="page-title">PROGRESS</h1></div>;

  const currentId = target ?? recorded[0]?.id ?? BW;
  const exercise = recorded.find((e) => e.id === currentId) ?? null;
  const metrics = exercise ? METRICS[exercise.type] : [];
  const activeMetric = metrics.find((m) => m.key === metric)?.key ?? metrics[0]?.key;
  const data = exercise && activeMetric ? progressSeries(workouts, exercise, activeMetric, range, now) : bodyweightSeries(logs, range, now);
  const fmt = FORMATS[exercise && activeMetric ? activeMetric : 'bw'];
  const last = data.at(-1);
  const diff = data.length >= 2 ? data[data.length - 1].value - data[0].value : 0;
  const best = exercise ? personalBest(workouts, exercise) : null;
  const oneRM = exercise?.type === 'weight' && best ? estimate1RM(best.set.weight, best.set.reps) : 0;

  return (
    <div className="page">
      <h1 className="page-title">PROGRESS</h1>
      <select className={s.select} aria-label="対象" value={currentId} onChange={(e) => setTarget(e.target.value)}>
        {recorded.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        <option value={BW}>体重</option>
      </select>
      <div className={s.seg}>
        {RANGES.map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
      </div>

      <div className={s.metricLabel}>{exercise ? metrics.find((m) => m.key === activeMetric)?.label : '体重'}</div>
      <div className={s.hero}>
        <div className={s.big}>{last ? fmt.value(last.value) : '–'}{last && fmt.unit && <small>{fmt.unit}</small>}</div>
        {data.length >= 2 && (
          <div className={diff > 0 ? s.up : diff < 0 ? s.down : s.flat}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '±'} {fmt.delta(Math.abs(diff))}</div>
        )}
      </div>

      {data.length >= 2 ? <ProgressChart data={data} format={(v) => fmt.value(v) + fmt.unit} /> : <div className={s.empty}>記録が増えるとグラフが表示されます</div>}

      {metrics.length > 1 && (
        <div className={s.metrics}>
          {metrics.map((m) => <button key={m.key} type="button" aria-pressed={activeMetric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>)}
        </div>
      )}

      {exercise && best && (
        <Card className={s.pb}>
          <span>自己ベスト</span>
          <span>{formatSet(exercise.type, best.set)}</span>
        </Card>
      )}

      {oneRM > 0 && (
        <>
          <div className="sec" style={{ textTransform: 'none' }}>%1RM（推定1RM {kg1(oneRM)}kg）</div>
          <PercentTable oneRM={oneRM} onPickWeight={setPlateKg} />
        </>
      )}
      <PlateSheet open={plateKg != null} initialKg={plateKg ?? 20} onClose={() => setPlateKg(null)} />
    </div>
  );
}

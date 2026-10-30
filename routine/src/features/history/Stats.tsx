import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMD, fromDateKey, startOfWeek, toDateKey } from '../../../../src/lib/dates';
import { addDays } from '../../lib/day';
import { currentStreak, itemRate, longestStreak, rangeRate } from '../../lib/stats';
import type { Item, Log } from '../../lib/types';
import s from './history.module.css';

// iPhone の Safari は SVG の属性の var() を解決しないことがあるので、色は値で書く（accent.css の --red と同じ）
const GREEN = '#22C55E';
const AXIS = { fill: '#8B8B94', fontFamily: 'Oswald, sans-serif', fontSize: 10 };

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function ValueChart({ item, logs, from, today }: { item: Item; logs: Log[]; from: string; today: string }) {
  const { ref, w } = useWidth();
  const byDate = new Map(logs.filter((l) => l.itemId === item.id).map((l) => [l.date, l.value]));
  const data: { date: number; value: number | null }[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) data.push({ date: fromDateKey(d).getTime(), value: byDate.get(d) ?? null });
  return (
    <div ref={ref} className={s.chart}>
      <LineChart width={w} height={180} data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#2A2A31" vertical={false} />
        <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatMD} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis domain={[0, 'auto']} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length && payload[0].payload.value != null ? (
              <div className={s.tip}>
                <b>{`${payload[0].payload.value}${item.unit ?? ''}`}</b>
                <span>{formatMD(payload[0].payload.date)}</span>
              </div>
            ) : null
          }
        />
        <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2} dot={{ r: 2, fill: GREEN }} connectNulls isAnimationActive={false} />
      </LineChart>
    </div>
  );
}

export function Stats({ items, logs, today }: { items: Item[]; logs: Log[]; today: string }) {
  const weekFrom = toDateKey(startOfWeek(fromDateKey(today).getTime()));
  const monthFrom = `${today.slice(0, 8)}01`;
  const from30 = addDays(today, -29);
  const logged = new Set(logs.map((l) => l.itemId));
  const listed = items.filter((it) => it.deletedAt == null || logged.has(it.id));
  const numbers = items.filter((it) => it.kind === 'number' && it.deletedAt == null);
  const [pick, setPick] = useState<string | null>(null);
  const chart = numbers.find((it) => it.id === pick) ?? numbers[0];

  const tiles = [
    { id: 'week', label: '今週', value: pct(rangeRate(items, logs, weekFrom, today, today)) },
    { id: 'month', label: '今月', value: pct(rangeRate(items, logs, monthFrom, today, today)) },
    { id: 'streak', label: '連続', value: `${currentStreak(items, logs, today)}日` },
    { id: 'longest', label: '最長', value: `${longestStreak(items, logs, today)}日` },
  ];

  return (
    <>
      <div className={s.tiles}>
        {tiles.map((t) => (
          <div key={t.id} data-testid={t.id}>
            <b className="num">{t.value}</b>
            <small className="muted">{t.label}</small>
          </div>
        ))}
      </div>
      <h2 className="sec">項目ごと（直近30日）</h2>
      <ul className={s.rates} aria-label="項目ごとの達成率">
        {listed.map((it) => {
          const r = itemRate(it, logs, from30, today, today);
          return (
            <li key={it.id}>
              <span>{it.deletedAt == null ? it.name : `${it.name}（削除済み）`}</span>
              <i style={{ width: `${Math.round((r ?? 0) * 100)}%` }} aria-hidden="true" />
              <b className="num">{pct(r)}</b>
            </li>
          );
        })}
      </ul>
      {chart && (
        <section>
          <h2 className="sec">{`${chart.name}の推移`}</h2>
          {numbers.length > 1 && (
            <div className={s.picker}>
              {numbers.map((it) => (
                <button key={it.id} type="button" aria-pressed={it.id === chart.id} onClick={() => setPick(it.id)}>{it.name}</button>
              ))}
            </div>
          )}
          <ValueChart item={chart} logs={logs} from={from30} today={today} />
        </section>
      )}
    </>
  );
}

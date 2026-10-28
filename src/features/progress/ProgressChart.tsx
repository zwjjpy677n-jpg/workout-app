import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { Point } from '../../lib/progress';
import s from './progress.module.css';

const RED = '#E10600';
const AXIS = { fill: '#8B8B94', fontFamily: 'Oswald, sans-serif', fontSize: 10 };

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

const md = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export function ProgressChart({ data, format }: { data: Point[]; format(v: number): string }) {
  const { ref, w } = useWidth();
  return (
    <div ref={ref} className={s.chart}>
      <AreaChart width={w} height={210} data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fillRed" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={RED} stopOpacity={0.4} />
            <stop offset="1" stopColor={RED} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2A2A31" vertical={false} />
        <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={md} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis domain={['auto', 'auto']} tick={AXIS} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => String(Math.round(v * 10) / 10)} />
        <Tooltip
          cursor={{ stroke: '#8B8B94', strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className={s.tip}>
                <b>{format(payload[0].payload.value)}</b>
                <span>{md(payload[0].payload.date)}</span>
              </div>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={RED}
          strokeWidth={2}
          fill="url(#fillRed)"
          dot={{ r: 4, fill: '#0B0B0D', stroke: RED, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: RED, stroke: '#0B0B0D', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}

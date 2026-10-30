import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import s from '../../../../src/features/calendar/calendar.module.css';
import { fromDateKey, monthGrid } from '../../../../src/lib/dates';
import { db } from '../../db/db';
import { useToday } from '../../hooks/useToday';
import { dayResult, rateLevel } from '../../lib/stats';
import type { Log } from '../../lib/types';
import { DaySheet } from './DaySheet';

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

export function HistoryPage() {
  const today = useToday();
  const [ym, setYm] = useState(() => {
    const d = fromDateKey(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [open, setOpen] = useState<string | null>(null);
  const items = useLiveQuery(() => db.items.toArray(), []);
  const logs = useLiveQuery(() => db.logs.toArray(), []);

  const shift = (dir: 1 | -1) => setYm(({ y, m }) => (m + dir < 0 ? { y: y - 1, m: 11 } : m + dir > 11 ? { y: y + 1, m: 0 } : { y, m: m + dir }));
  const byDate = new Map<string, Log[]>();
  for (const l of logs ?? []) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);

  return (
    <div className="page">
      <h1 className="page-title">記録</h1>
      <div className={s.head}>
        <button type="button" className={s.arrow} aria-label="前の月" onClick={() => shift(-1)}>‹</button>
        <h2>{`${ym.y}年${ym.m + 1}月`}</h2>
        <button type="button" className={s.arrow} aria-label="次の月" onClick={() => shift(1)}>›</button>
      </div>
      <div className={s.grid}>
        {WEEK.map((w) => <div key={w} className={s.w}>{w}</div>)}
        {monthGrid(ym.y, ym.m).map((c) => {
          const d = fromDateKey(c.key);
          const r = items && c.key <= today ? dayResult(items, byDate.get(c.key) ?? [], c.key, today) : null;
          return (
            <button
              key={c.key}
              type="button"
              aria-label={`${d.getMonth() + 1}月${d.getDate()}日`}
              disabled={c.key > today}
              data-level={r ? rateLevel(r.done / r.total) : undefined}
              className={`${s.d} ${c.inMonth ? '' : s.out} ${c.key === today ? s.isToday : ''}`}
              onClick={() => setOpen(c.key)}
            >
              {c.day}
            </button>
          );
        })}
      </div>
      {open && <DaySheet date={open} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

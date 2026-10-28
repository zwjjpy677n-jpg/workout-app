import { useRef } from 'react';
import { monthGrid, toDateKey } from '../../lib/dates';
import { volumeLevel } from '../../lib/summary';
import s from './calendar.module.css';

type Props = {
  year: number;
  month0: number;
  byDay: Record<string, number>;
  selected: string;
  onSelect(key: string): void;
  onSwipe(dir: 1 | -1): void;
};

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

export function MonthGrid({ year, month0, byDay, selected, onSelect, onSwipe }: Props) {
  const startX = useRef<number | null>(null);
  const max = Math.max(0, ...Object.values(byDay));
  const today = toDateKey(Date.now());

  return (
    <div
      className={s.grid}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current == null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 50) onSwipe(dx < 0 ? 1 : -1);
        startX.current = null;
      }}
    >
      {WEEK.map((w) => <div key={w} className={s.w}>{w}</div>)}
      {monthGrid(year, month0).map((c) => {
        const [, m, d] = c.key.split('-').map(Number);
        const trained = c.key in byDay;
        return (
          <button
            key={c.key}
            type="button"
            aria-label={`${m}月${d}日`}
            aria-pressed={selected === c.key}
            data-level={trained ? volumeLevel(byDay[c.key], max) : undefined}
            className={`${s.d} ${c.inMonth ? '' : s.out} ${selected === c.key ? s.sel : ''} ${c.key === today ? s.isToday : ''}`}
            onClick={() => onSelect(c.key)}
          >
            {c.day}
          </button>
        );
      })}
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { fromDateKey } from '../../../../src/lib/dates';
import { db } from '../../db/db';
import { useToday } from '../../hooks/useToday';
import { currentStreak, dayResult } from '../../lib/stats';
import { RoutineList } from './RoutineList';
import { TodoList } from './TodoList';
import s from './today.module.css';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

function Summary({ today }: { today: string }) {
  const items = useLiveQuery(() => db.items.toArray(), []);
  const logs = useLiveQuery(() => db.logs.toArray(), []);
  if (!items || !logs) return null;
  const r = dayResult(items, logs, today, today);
  const streak = currentStreak(items, logs, today);
  return (
    <div className={s.summary} data-testid="summary">
      <div><b className="num">{r ? `${r.done}/${r.total}` : '0/0'}</b><small className="muted">できた</small></div>
      <div><b className="num">{r ? `${Math.round((r.done / r.total) * 100)}%` : '—'}</b><small className="muted">達成率</small></div>
      <div><b className="num">{`🔥 ${streak}日`}</b><small className="muted">連続</small></div>
    </div>
  );
}

export function TodayPage() {
  const today = useToday();
  const d = fromDateKey(today);
  return (
    <div className="page">
      <h1 className="page-title">{`${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`}</h1>
      <Summary today={today} />
      <RoutineList date={today} today={today} />
      <TodoList today={today} />
    </div>
  );
}

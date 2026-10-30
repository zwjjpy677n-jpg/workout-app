import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { itemsForDay } from '../../lib/schedule';
import { SLOTS } from '../../lib/types';
import { RoutineRow } from './RoutineRow';
import s from './today.module.css';

/** その日のルーティンを時間帯ごとに並べる。今日の画面と、記録の日ごとのシートで使う */
export function RoutineList({ date, today }: { date: string; today: string }) {
  const items = useLiveQuery(() => db.items.toArray(), []);
  const logs = useLiveQuery(() => db.logs.where('date').equals(date).toArray(), [date]);
  if (!items || !logs) return null;
  const due = itemsForDay(items, date, logs, today);
  if (due.length === 0) return <p className="muted">この日のルーティンはありません</p>;
  const byItem = new Map(logs.map((l) => [l.itemId, l]));
  return (
    <>
      {SLOTS.map(({ key, label }) => {
        const list = due.filter((it) => it.slot === key);
        if (list.length === 0) return null;
        return (
          <section key={key}>
            <h2 className="sec">{label}</h2>
            <div className={s.list}>
              {list.map((it) => <RoutineRow key={it.id} item={it} log={byItem.get(it.id)} date={date} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

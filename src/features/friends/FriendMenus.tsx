import { Card } from '../../components/Card';
import type { Friend } from '../../lib/share/importShare';
import { WEEKDAY_LABEL } from '../../lib/types';
import s from './friends.module.css';

export function FriendMenus({ friend }: { friend: Friend }) {
  const exName = new Map(friend.exercises.map((e) => [e.id, e.name]));
  // 月曜はじまりの曜日順、曜日なしは最後
  const order = (d: number | null) => (d == null ? 99 : (d + 6) % 7);
  const menus = [...friend.routines].sort((a, b) => order(a.weekday) - order(b.weekday));
  if (menus.length === 0) return <p className={s.empty}>メニューはありません</p>;
  return (
    <>
      {menus.map((r) => (
        <Card key={r.id} className={s.menu}>
          <article>
            <h2 className={s.day}>{r.weekday == null ? r.name : `${r.name}（${WEEKDAY_LABEL[r.weekday]}）`}</h2>
            {r.items.map((it, i) => (
              <div key={i} className={s.entry}>
                <span>
                  {exName.get(it.exerciseId)}
                  {it.main && <em className={s.main}>メイン</em>}
                </span>
                <span className="num">{`${it.sets}セット×${it.reps}`}</span>
              </div>
            ))}
          </article>
        </Card>
      ))}
    </>
  );
}

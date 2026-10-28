import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { Friend } from '../../lib/share/importShare';
import { WEEKDAY_LABEL } from '../../lib/types';
import { SentMenus } from './SentMenus';
import s from './friends.module.css';

export function FriendMenus({ friend }: { friend: Friend }) {
  const navigate = useNavigate();
  const exName = new Map(friend.exercises.map((e) => [e.id, e.name]));
  // 月曜はじまりの曜日順、曜日なしは最後
  const order = (d: number | null) => (d == null ? 99 : (d + 6) % 7);
  const menus = [...friend.routines].sort((a, b) => order(a.weekday) - order(b.weekday));
  return (
    <>
      <Button block variant="primary" className={s.sendFb} onClick={() => navigate(`/friends/${friend.id}/menu/new`)}>メニューを組んで送る</Button>
      {menus.length === 0 && <p className={s.empty}>メニューはありません</p>}
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
      <SentMenus friendId={friend.id} />
    </>
  );
}

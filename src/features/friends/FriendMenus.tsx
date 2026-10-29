import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { Friend } from '../../lib/share/importShare';
import { menuTitle } from '../../lib/share/menuPayload';
import { SentMenus } from './SentMenus';
import s from './friends.module.css';

/** 友達が共有してくれたメニューと、友達に送るメニューを組む入口・送った履歴 */
export function FriendMenus({ friend }: { friend: Friend }) {
  const navigate = useNavigate();
  const exName = new Map(friend.exercises.map((e) => [e.id, e.name]));
  // 月曜はじまりの曜日順、曜日なしは最後
  const order = (d: number | null) => (d == null ? 99 : (d + 6) % 7);
  const menus = [...friend.routines].sort((a, b) => order(a.weekday) - order(b.weekday));
  return (
    <>
      <Button block variant="primary" className={s.sendFb} onClick={() => navigate(`/friends/${friend.id}/menu/new`)}>メニューを組んで送る</Button>
      {menus.length === 0 && <p className={s.empty}>{`${friend.name}さんのメニューはまだ共有されていません`}</p>}
      {menus.map((r) => (
        <Card key={r.id} className={s.menu}>
          <article>
            <h2 className={s.day}>{menuTitle(r.name, r.weekday)}</h2>
            {r.items.map((it, i) => (
              <div key={i} className={s.entry}>
                <span>
                  {exName.get(it.exerciseId)}
                  {it.main && <em className={s.main}>メイン</em>}
                </span>
                <span className="num">{`${it.sets}セット×${it.reps}`}</span>
              </div>
            ))}
            <button
              type="button"
              className={s.menuLink}
              aria-label={`${menuTitle(r.name, r.weekday)}の記録とグラフ`}
              onClick={() => navigate(`/friends/${friend.id}/menus/${encodeURIComponent(r.name)}`)}
            >
              記録とグラフを見る ›
            </button>
          </article>
        </Card>
      ))}
      <SentMenus friendId={friend.id} />
    </>
  );
}

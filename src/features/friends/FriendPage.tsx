import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { deleteFriend } from '../../db/friends';
import { useFriend, useFriendWorkouts } from '../../hooks/useData';
import { formatMD } from '../../lib/dates';
import { FriendExercises } from './FriendExercises';
import { FriendMenus } from './FriendMenus';
import { FriendWeeks } from './FriendWeeks';
import { SendFeedback } from './SendFeedback';
import s from './friends.module.css';

const TABS = [
  { key: 'weeks', label: '記録' },
  { key: 'exercises', label: '種目' },
  { key: 'menus', label: 'メニュー' },
] as const;

export function FriendPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const friend = useFriend(id);
  const workouts = useFriendWorkouts(id);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(TABS.find((t) => t.key === params.get('tab'))?.key ?? 'weeks');
  const exMap = useMemo(() => new Map(friend?.exercises.map((e) => [e.id, e])), [friend]);

  if (friend === null) return <Navigate to="/friends" replace />;
  if (!friend || !workouts) return null;

  const remove = async () => {
    if (!window.confirm(`${friend.name}さんと受け取った記録を削除しますか？`)) return;
    await deleteFriend(friend.id);
    navigate('/friends', { replace: true });
  };

  return (
    <div className="page">
      <button type="button" className={s.back} onClick={() => navigate('/friends')}>‹ 友達</button>
      <h1 className={s.friendName}>{friend.name}</h1>
      <p className={s.sub}>受け取り {formatMD(friend.receivedAt)} ・ 記録 {workouts.length}回分</p>
      <SendFeedback friendId={friend.id} />
      <div className={s.seg} role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'weeks' && <FriendWeeks friendId={friend.id} workouts={workouts} exercises={exMap} />}
      {tab === 'exercises' && <FriendExercises friend={friend} workouts={workouts} />}
      {tab === 'menus' && <FriendMenus friend={friend} />}
      {/* オンラインの友達は次の受け取りでまた作られるので、削除は出さない（解除は次の段階） */}
      {!friend.online && <Button block variant="danger" className={s.remove} onClick={remove}>この友達を削除</Button>}
    </div>
  );
}

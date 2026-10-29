import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import type { Friend } from '../../lib/share/importShare';
import { SentMenus } from './SentMenus';
import s from './friends.module.css';

/** 友達に送るメニューを組む入口と、送ったメニューの履歴。友達自身のメニューは共有しないので出さない */
export function FriendMenus({ friend }: { friend: Friend }) {
  const navigate = useNavigate();
  return (
    <>
      <Button block variant="primary" className={s.sendFb} onClick={() => navigate(`/friends/${friend.id}/menu/new`)}>メニューを組んで送る</Button>
      <p className={s.hint}>{`${friend.name}さんのためのメニューを一から組んで、LINE で送れます`}</p>
      <SentMenus friendId={friend.id} />
    </>
  );
}

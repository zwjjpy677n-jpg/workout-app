import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useFriends, useProfile } from '../../hooks/useData';
import { formatMD } from '../../lib/dates';
import { useUnread } from '../../lib/online/pull';
import { Inbox } from './Inbox';
import { MenuPickSheet } from './MenuPickSheet';
import { NameSheet } from './NameSheet';
import { OnlineSection } from './OnlineSection';
import { PasteSheet } from './PasteSheet';
import { useShareMine } from './useShareMine';
import s from './friends.module.css';

export function FriendsPage() {
  const navigate = useNavigate();
  const friends = useFriends();
  const profile = useProfile();
  // 共有するメニューは毎回選ぶ（覚えておかない。選ばなければ記録だけ送る）
  const [menuIds, setMenuIds] = useState<string[]>([]);
  const { shareMine, note, ready, hasProfile, loading, trimmedWeeks } = useShareMine(menuIds);
  const unread = useUnread();
  const [sheet, setSheet] = useState<'name' | 'rename' | 'paste' | 'menus' | null>(null);

  const onShare = () => (hasProfile ? shareMine() : setSheet('name'));

  return (
    <div className="page">
      <h1 className="page-title">FRIENDS</h1>
      <OnlineSection />
      <div className={s.actions}>
        <Button block onClick={() => setSheet('menus')}>{`共有するメニューを選ぶ（${menuIds.length}件）`}</Button>
        <Button block variant="primary" disabled={loading || (hasProfile && !ready)} onClick={onShare}>{menuIds.length ? '自分の記録とメニューを共有' : '自分の記録を共有'}</Button>
        {trimmedWeeks != null && <p className={s.hint}>直近{trimmedWeeks}週ぶんを共有します</p>}
        <Button block onClick={() => setSheet('paste')}>リンクを貼り付けて追加</Button>
      </div>
      {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}

      <Inbox />

      {friends && friends.length === 0 && <p className={s.empty}>まだ友達がいません。友達に キントレ部 の記録を送ってもらって、ここに貼り付けてください</p>}
      <div className={s.list}>
        {friends?.map((f) => (
          <button key={f.id} type="button" className={s.item} onClick={() => navigate(`/friends/${f.id}`)}>
            <div>
              <div className={s.nameRow}>
                <div className={s.name}>{f.name}</div>
                {f.online && <span className={s.onlineTag}>オンライン</span>}
                {unread.friends.has(f.id) && <i className={s.unread} role="img" aria-label="未読" />}
              </div>
              <div className={s.sub}>
                {f.lastAt != null && <span>最後のトレーニング {formatMD(f.lastAt)}</span>}
                <span>受け取り {formatMD(f.receivedAt)}</span>
              </div>
            </div>
            <span className={s.chev}>›</span>
          </button>
        ))}
      </div>

      {profile && (
        <button type="button" className={s.link} onClick={() => setSheet('rename')}>
          名前を変える（今: {profile.name}）
        </button>
      )}

      <NameSheet open={sheet === 'name'} initial="" onClose={() => setSheet(null)} onShare={shareMine} ready={ready} />
      <NameSheet open={sheet === 'rename'} initial={profile?.name ?? ''} onClose={() => setSheet(null)} />
      <PasteSheet open={sheet === 'paste'} onClose={() => setSheet(null)} />
      <MenuPickSheet
        open={sheet === 'menus'}
        selected={menuIds}
        onClose={() => setSheet(null)}
        onDone={(ids) => {
          setMenuIds(ids);
          setSheet(null);
        }}
      />
    </div>
  );
}

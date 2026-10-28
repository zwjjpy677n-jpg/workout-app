import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useFriends, useProfile } from '../../hooks/useData';
import { formatMD } from '../../lib/dates';
import { Inbox } from './Inbox';
import { NameSheet } from './NameSheet';
import { PasteSheet } from './PasteSheet';
import { useShareMine } from './useShareMine';
import s from './friends.module.css';

export function FriendsPage() {
  const navigate = useNavigate();
  const friends = useFriends();
  const profile = useProfile();
  const { shareMine, note, ready, hasProfile, loading, trimmedWeeks } = useShareMine();
  const [sheet, setSheet] = useState<'name' | 'rename' | 'paste' | null>(null);

  const onShare = () => (hasProfile ? shareMine() : setSheet('name'));

  return (
    <div className="page">
      <h1 className="page-title">FRIENDS</h1>
      <div className={s.actions}>
        <Button block variant="primary" disabled={loading || (hasProfile && !ready)} onClick={onShare}>自分の記録を共有</Button>
        {trimmedWeeks != null && <p className={s.hint}>直近{trimmedWeeks}週ぶんを共有します</p>}
        <Button block onClick={() => setSheet('paste')}>リンクを貼り付けて追加</Button>
      </div>
      {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}

      <Inbox />

      {friends && friends.length === 0 && <p className={s.empty}>まだ友達がいません。友達に GRIND の記録を送ってもらって、ここに貼り付けてください</p>}
      <div className={s.list}>
        {friends?.map((f) => (
          <button key={f.id} type="button" className={s.item} onClick={() => navigate(`/friends/${f.id}`)}>
            <div>
              <div className={s.name}>{f.name}</div>
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
    </div>
  );
}

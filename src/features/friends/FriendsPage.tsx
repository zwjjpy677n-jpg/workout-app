import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useExerciseMap, useFriends, useProfile, useRoutines } from '../../hooks/useData';
import { formatMD } from '../../lib/dates';
import { queueMenu } from '../../lib/online/outbox';
import { routineToMenuPayload } from '../../lib/share/menuPayload';
import { useUnread } from '../../lib/online/pull';
import { Inbox } from './Inbox';
import { MenuInbox } from './MenuInbox';
import { MenuPickSheet } from './MenuPickSheet';
import { flushNote, senderIdentity } from './appSend';
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
  const [sheet, setSheet] = useState<'name' | 'rename' | 'paste' | 'menus' | 'target' | null>(null);
  const routines = useRoutines();
  const exercises = useExerciseMap();
  const [appNote, setAppNote] = useState<string | null>(null);
  const online = (friends ?? []).filter((f) => f.online);

  const sendToApp = async (userId: string) => {
    setSheet(null);
    setAppNote(null);
    if (!routines || !exercises) return;
    const from = await senderIdentity();
    const payloads = routines.filter((r) => menuIds.includes(r.id)).map((r) => routineToMenuPayload(r, exercises, from, userId, Date.now()));
    for (const p of payloads) if (p) await queueMenu(userId, 'mine', p);
    if (payloads.some(Boolean)) setAppNote(await flushNote());
    else setAppNote('送れるメニューがありません');
  };

  const onShare = () => (hasProfile ? shareMine() : setSheet('name'));

  return (
    <div className="page">
      <h1 className="page-title">FRIENDS</h1>
      <OnlineSection />
      <div className={s.actions}>
        <Button block onClick={() => setSheet('menus')}>{`共有するメニューを選ぶ（${menuIds.length}件）`}</Button>
        <Button block variant="primary" disabled={loading || (hasProfile && !ready)} onClick={onShare}>{menuIds.length ? '自分の記録とメニューを共有' : '自分の記録を共有'}</Button>
        {trimmedWeeks != null && <p className={s.hint}>直近{trimmedWeeks}週ぶんを共有します</p>}
        {online.length > 0 && menuIds.length > 0 && (
          <Button block aria-label="メニューをアプリで送る" onClick={() => (online.length === 1 ? void sendToApp(online[0].online!.userId) : setSheet('target'))}>メニューをアプリで送る</Button>
        )}
        <Button block onClick={() => setSheet('paste')}>リンクを貼り付けて追加</Button>
      </div>
      {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}

      {appNote && <p role="status" className={s.ok}>{appNote}</p>}
      <Inbox />
      <MenuInbox />

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
      <Sheet open={sheet === 'target'} title="送る相手" onClose={() => setSheet(null)}>
        {online.map((f) => (
          <Button key={f.id} block onClick={() => void sendToApp(f.online!.userId)}>{f.name}</Button>
        ))}
      </Sheet>
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

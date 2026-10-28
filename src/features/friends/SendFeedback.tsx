import { useState } from 'react';
import { Button } from '../../components/Button';
import { markSent } from '../../db/feedback';
import { useFeedbackOut, useProfile } from '../../hooks/useData';
import { ShareError } from '../../lib/share/codec';
import { buildFeedbackLink } from '../../lib/share/feedbackPayload';
import { NameSheet } from './NameSheet';
import { usePreparedLink } from './usePreparedLink';
import { sendText, type ShareNote } from './useShareMine';
import s from './friends.module.css';

/** 未送信のコメントをまとめてリンクにして送る。リンクは前もって作り、押したその場で共有画面を出す */
export function SendFeedback({ friendId }: { friendId: string }) {
  const profile = useProfile();
  const unsent = (useFeedbackOut(friendId) ?? []).filter((f) => f.sentAt == null);
  const key = unsent.map((f) => `${f.id}:${f.text}`).join('|');
  const link = usePreparedLink(profile && unsent.length ? () => buildFeedbackLink(profile, friendId, unsent, Date.now()) : null, [profile, key]);
  const [note, setNote] = useState<ShareNote>(null);
  const [naming, setNaming] = useState(false);
  if (!unsent.length) return note ? <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p> : null;

  const send = () => {
    setNote(null);
    if (!profile) return setNaming(true);
    if (!link) return;
    if (link instanceof ShareError) return setNote({ kind: 'alert', text: '共有できませんでした' });
    const { text, sent } = link;
    void sendText(text, setNote).then((r) => {
      if (r === 'shared' || r === 'copied') return markSent(sent, Date.now());
    });
  };
  const partial = link && !(link instanceof ShareError) && link.rest > 0 ? link.sent.length : null;

  return (
    <div className={s.sendFb}>
      <Button block variant="primary" disabled={!!profile && !link} onClick={send}>{`フィードバックを送る（${unsent.length}件）`}</Button>
      {partial != null && <p className={s.hint}>{`${partial}件だけ送ります。残りは次に送ってください`}</p>}
      {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}
      <NameSheet open={naming} initial="" onClose={() => setNaming(false)} onShare={send} ready={!!link} />
    </div>
  );
}

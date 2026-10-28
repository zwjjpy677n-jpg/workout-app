import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { markRead } from '../../db/feedback';
import { useInbox } from '../../hooks/useData';
import { formatMD, toDateKey } from '../../lib/dates';
import type { FeedbackIn } from '../../lib/share/feedbackPayload';
import s from './friends.module.css';

/** 友達から届いたコメント。押すとカレンダーのその日（記録の日 → 週の月曜 → 書かれた日）へ */
export function Inbox() {
  const navigate = useNavigate();
  const inbox = useInbox();
  const days = useLiveQuery(async () => {
    const ids = (inbox ?? []).map((f) => f.workoutId).filter((x): x is string => !!x);
    const ws = await db.workouts.bulkGet(ids);
    return new Map(ws.filter(Boolean).map((w) => [w!.id, toDateKey(w!.startedAt)]));
  }, [inbox]);
  if (!inbox?.length) return null;

  const dayOf = (f: FeedbackIn) => (f.workoutId && days?.get(f.workoutId)) || f.week || toDateKey(f.at);
  const open = async (f: FeedbackIn) => {
    await markRead(f.id);
    navigate(`/calendar?date=${dayOf(f)}`);
  };

  return (
    <section aria-label="届いたフィードバック" className={s.inbox}>
      <h2 className={s.weekHead}>届いたフィードバック</h2>
      {inbox.map((f) => (
        <button key={f.id} type="button" className={s.inboxItem} onClick={() => open(f)}>
          <span className={s.inboxHead}>
            {!f.read && <i aria-label="未読" className={s.unread} />}
            {`${f.friendName}さん ${formatMD(f.at)}`}
          </span>
          <span>{f.text}</span>
        </button>
      ))}
    </section>
  );
}

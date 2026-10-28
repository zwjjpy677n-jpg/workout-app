import type { FeedbackOut } from '../../lib/share/feedbackPayload';
import type { CommentTarget } from './CommentSheet';
import s from './friends.module.css';

const same = (f: FeedbackOut, t: CommentTarget) => f.workoutId === t.workoutId && f.week === t.week && f.exerciseId === t.exerciseId;

/** その場所に書いた自分のコメント。未送信は押すと編集 */
export function CommentList({ all, at, onEdit }: { all: FeedbackOut[]; at: CommentTarget; onEdit(f: FeedbackOut): void }) {
  const list = all.filter((f) => same(f, at));
  if (!list.length) return null;
  return (
    <div className={s.comments}>
      {list.map((f) => (
        <button key={f.id} type="button" className={s.comment} disabled={f.sentAt != null} onClick={() => onEdit(f)}>
          {`あなた: ${f.text}（${f.sentAt == null ? '未送信' : '送信済み'}）`}
        </button>
      ))}
    </div>
  );
}

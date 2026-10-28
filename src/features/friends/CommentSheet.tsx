import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { deleteDraft, saveDraft } from '../../db/feedback';
import { COMMENT_MAX, type FeedbackOut } from '../../lib/share/feedbackPayload';
import s from './friends.module.css';

/** コメントの場所（友達の記録・種目・週） */
export type CommentTarget = Pick<FeedbackOut, 'friendId' | 'workoutId' | 'week' | 'exerciseId'>;

type Props = { target: CommentTarget | null; draft: FeedbackOut | null; onClose(): void };

export function CommentSheet({ target, draft, onClose }: Props) {
  const [text, setText] = useState('');
  useEffect(() => setText(draft?.text ?? ''), [draft, target]);
  const v = text.trim();
  const ok = v.length >= 1 && v.length <= COMMENT_MAX;
  return (
    <Sheet open={!!target} title="コメント" onClose={onClose}>
      <textarea aria-label="コメント" className={s.area} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${COMMENT_MAX}文字まで`} autoFocus />
      <div className={s.actions}>
        <Button
          block
          variant="primary"
          disabled={!ok}
          onClick={async () => {
            await saveDraft({ ...target!, id: draft?.id, text: v });
            onClose();
          }}
        >
          保存
        </Button>
        {draft && (
          <Button
            block
            variant="danger"
            onClick={async () => {
              await deleteDraft(draft.id);
              onClose();
            }}
          >
            削除
          </Button>
        )}
      </div>
    </Sheet>
  );
}

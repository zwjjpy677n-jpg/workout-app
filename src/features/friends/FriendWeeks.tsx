import { useState } from 'react';
import { Card } from '../../components/Card';
import { useFeedbackOut } from '../../hooks/useData';
import { volumeParts } from '../../lib/calc';
import { conditionText } from '../../lib/condition';
import { formatMD, formatMDW, toDateKey } from '../../lib/dates';
import type { FeedbackOut } from '../../lib/share/feedbackPayload';
import { friendWeeks } from '../../lib/share/friendWeeks';
import { workoutMinutes as minutes } from '../../lib/online/sharedWorkout';
import type { FriendWorkout } from '../../lib/share/importShare';
import type { Exercise } from '../../lib/types';
import { summarizeSets } from '../calendar/summarizeSets';
import { CommentList } from './CommentList';
import { CommentSheet, type CommentTarget } from './CommentSheet';
import s from './friends.module.css';

type Props = { friendId: string; workouts: FriendWorkout[]; exercises: Map<string, Exercise> };

export function FriendWeeks({ friendId, workouts, exercises }: Props) {
  const comments = useFeedbackOut(friendId) ?? [];
  const [editing, setEditing] = useState<{ target: CommentTarget; draft: FeedbackOut | null } | null>(null);
  const weeks = friendWeeks(workouts, exercises);
  if (weeks.length === 0) return <p className={s.empty}>まだ記録がありません</p>;

  const at = (workoutId: string | null, week: string | null, exerciseId: string | null): CommentTarget => ({ friendId, workoutId, week, exerciseId });
  const write = (target: CommentTarget) => setEditing({ target, draft: null });
  const edit = (f: FeedbackOut) => setEditing({ target: f, draft: f });
  const bubble = (label: string, target: CommentTarget) => (
    <button type="button" aria-label={label} className={s.bubble} onClick={() => write(target)}>💬</button>
  );

  return (
    <>
      {weeks.map((wk) => {
        const v = volumeParts(wk.volume);
        const title = `${formatMD(wk.start)}〜${formatMD(wk.end)} ・ ${wk.days}日 ・ ${v.value}${v.unit}`;
        const weekAt = at(null, toDateKey(wk.start), null);
        return (
          <section key={wk.start} aria-label={title} className={s.week}>
            <div className={s.weekRow}>
              <h2 className={s.weekHead}>{title}</h2>
              {bubble('この週にコメント', weekAt)}
            </div>
            <CommentList all={comments} at={weekAt} onEdit={edit} />
            {wk.workouts.map((w) => {
              const dayAt = at(w.id, null, null);
              return (
                <Card key={w.id}>
                  <div className={s.dayRow}>
                    <div className={s.day}>{`${formatMDW(w.startedAt)} ${w.name}${minutes(w) === null ? '' : ` ・ ${minutes(w)}分`}`}</div>
                    {bubble('この日にコメント', dayAt)}
                  </div>
                  {conditionText(w.condition) && <div className={s.cond}>{conditionText(w.condition)}</div>}
                  {w.entries.map((e, i) => {
                    const ex = exercises.get(e.exerciseId);
                    if (!ex) return null;
                    const exAt = at(w.id, null, e.exerciseId);
                    return (
                      <div key={i}>
                        <div className={s.entry}>
                          <span>{ex.name}</span>
                          <span className={s.entryRight}>
                            <span className="num">{summarizeSets(ex.type, e.sets)}</span>
                            {bubble(`${ex.name}にコメント`, exAt)}
                          </span>
                        </div>
                        <CommentList all={comments} at={exAt} onEdit={edit} />
                      </div>
                    );
                  })}
                  <CommentList all={comments} at={dayAt} onEdit={edit} />
                </Card>
              );
            })}
          </section>
        );
      })}
      <CommentSheet target={editing?.target ?? null} draft={editing?.draft ?? null} onClose={() => setEditing(null)} />
    </>
  );
}

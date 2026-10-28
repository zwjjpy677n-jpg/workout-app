import { useNavigate } from 'react-router-dom';
import { formatSet } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import type { Friend, FriendWorkout } from '../../lib/share/importShare';
import { BODY_PART_LABEL } from '../../lib/types';
import s from './friends.module.css';

export function FriendExercises({ friend, workouts }: { friend: Friend; workouts: FriendWorkout[] }) {
  const navigate = useNavigate();
  const last = new Map<string, number>();
  for (const w of workouts) for (const e of w.entries) last.set(e.exerciseId, Math.max(last.get(e.exerciseId) ?? 0, w.startedAt));
  const rows = friend.exercises.filter((e) => last.has(e.id)).sort((a, b) => last.get(b.id)! - last.get(a.id)!);
  if (rows.length === 0) return <p className={s.empty}>まだ記録がありません</p>;
  return (
    <div className={s.list}>
      {rows.map((e) => {
        const pr = friend.prs.find((p) => p.exerciseId === e.id);
        return (
          <button key={e.id} type="button" className={s.item} onClick={() => navigate(`/friends/${friend.id}/exercise/${e.id.slice(friend.id.length + 1)}`)}>
            <div>
              <div className={s.name}>{e.name}</div>
              <div className={s.sub}>
                <span>{BODY_PART_LABEL[e.bodyPart]}</span>
                {pr && <span>ベスト {formatSet(e.type, pr.set)}</span>}
                <span>最後 {formatMD(last.get(e.id)!)}</span>
              </div>
            </div>
            <span className={s.chev}>›</span>
          </button>
        );
      })}
    </div>
  );
}

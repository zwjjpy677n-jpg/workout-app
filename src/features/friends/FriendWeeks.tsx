import { Card } from '../../components/Card';
import { volumeParts } from '../../lib/calc';
import { formatMD, formatMDW } from '../../lib/dates';
import { friendWeeks } from '../../lib/share/friendWeeks';
import type { FriendWorkout } from '../../lib/share/importShare';
import type { Exercise } from '../../lib/types';
import { summarizeSets } from '../calendar/summarizeSets';
import s from './friends.module.css';

export function FriendWeeks({ workouts, exercises }: { workouts: FriendWorkout[]; exercises: Map<string, Exercise> }) {
  const weeks = friendWeeks(workouts, exercises);
  if (weeks.length === 0) return <p className={s.empty}>まだ記録がありません</p>;
  return (
    <>
      {weeks.map((wk) => {
        const v = volumeParts(wk.volume);
        const title = `${formatMD(wk.start)}〜${formatMD(wk.end)} ・ ${wk.days}日 ・ ${v.value}${v.unit}`;
        return (
          <section key={wk.start} aria-label={title} className={s.week}>
            <h2 className={s.weekHead}>{title}</h2>
            {wk.workouts.map((w) => (
              <Card key={w.id}>
                <div className={s.day}>{`${formatMDW(w.startedAt)} ${w.name}`}</div>
                {w.entries.map((e, i) => {
                  const ex = exercises.get(e.exerciseId);
                  return ex ? (
                    <div key={i} className={s.entry}>
                      <span>{ex.name}</span>
                      <span className="num">{summarizeSets(ex.type, e.sets)}</span>
                    </div>
                  ) : null;
                })}
              </Card>
            ))}
          </section>
        );
      })}
    </>
  );
}

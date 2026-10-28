import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { deleteWorkout } from '../../db/repository';
import { formatKg } from '../../lib/calc';
import { formatMDW, fromDateKey, toDateKey } from '../../lib/dates';
import type { BodyweightLog, Condition, Exercise, Workout } from '../../lib/types';
import { summarizeSets } from './summarizeSets';
import s from './calendar.module.css';

const COND: [keyof Condition, string][] = [['sleep', '睡眠'], ['fatigue', '疲労感'], ['motivation', 'やる気']];

function conditionText(c: Condition): string {
  return COND.filter(([k]) => c[k] != null).map(([k, l]) => `${l} ${c[k]}`).join(' ・ ');
}

type Props = { dateKey: string; workouts: Workout[]; bodyweights: BodyweightLog[]; exercises: Map<string, Exercise> };

export function DayDetail({ dateKey, workouts, bodyweights, exercises }: Props) {
  const navigate = useNavigate();
  const title = formatMDW(fromDateKey(dateKey).getTime());
  const list = workouts.filter((w) => w.endedAt !== null && toDateKey(w.startedAt) === dateKey);
  const bw = bodyweights.find((b) => b.date === dateKey);

  return (
    <section aria-label={title} className={s.detail}>
      <div className={s.wHead}>
        <span className={s.dTitle}>{title}</span>
        {bw && <span className={s.meta}>体重 {formatKg(bw.kg)}kg{bw.fatPct != null ? ` ・ 体脂肪 ${formatKg(bw.fatPct)}%` : ''}</span>}
      </div>
      {list.length === 0 && <p className={s.empty}>この日のトレーニングはありません</p>}
      {list.map((w) => (
        <Card key={w.id}>
          <div className={s.wHead}>
            <span className={s.wName}>{w.name}</span>
            <div className={s.btns}>
              <button type="button" onClick={() => navigate(`/workout/${w.id}`)}>編集</button>
              <button
                type="button"
                className={s.del}
                onClick={() => window.confirm(`${title} の「${w.name}」を削除しますか？`) && deleteWorkout(w.id)}
              >
                削除
              </button>
            </div>
          </div>
          {conditionText(w.condition) && <div className={s.meta}>{conditionText(w.condition)}</div>}
          {w.entries.map((e, i) => {
            const ex = exercises.get(e.exerciseId);
            const text = ex ? summarizeSets(ex.type, e.sets) : '';
            if (!ex || !text) return null;
            return (
              <div key={i} className={s.ex}>
                <span>{ex.name}</span>
                <span>{text}</span>
              </div>
            );
          })}
          {w.note && <div className={s.note}>{w.note}</div>}
        </Card>
      ))}
    </section>
  );
}

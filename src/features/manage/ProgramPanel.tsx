import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { saveProgram } from '../../db/repository';
import { useProgram } from '../../hooks/useData';
import { toDateKey } from '../../lib/dates';
import { programStatus } from '../../lib/program';
import s from './manage.module.css';

const fresh = (startDate: string) => ({ startDate, tests: { start: null, end: null } });

export function ProgramPanel() {
  const program = useProgram();
  const [start, setStart] = useState(() => toDateKey(Date.now()));
  if (program === undefined) return null;
  const today = toDateKey(Date.now());

  if (!program) {
    return (
      <>
        <p className={s.note}>8週間で取り組みます。4週目と8週目は回復週（重さはそのまま、セット数を半分）、8週目にテストで伸びを確かめます。</p>
        <p className={s.note}>始める前に、グラフ › 8週間テストで「開始時」のメイン種目の5RMと体重を入れておくと、8週目に伸びを比べられます。</p>
        <label className={s.field}>
          <span>開始日</span>
          <input type="date" className={s.text} aria-label="開始日" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <Button block variant="primary" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(start)} onClick={() => saveProgram(fresh(start))}>
          この日から始める
        </Button>
      </>
    );
  }

  const st = programStatus(program, today);
  return (
    <>
      <Card>
        <div className={s.sub}>開始日 {program.startDate.replaceAll('-', '/')}</div>
        <div className={s.big} style={{ margin: '6px 0' }}>{st.inRange ? `今 ${st.week}週目` : st.label}</div>
        {st.inRange && st.label && <div className={s.sub}>{st.label}</div>}
      </Card>
      <div className={s.actions}>
        <Button onClick={() => window.confirm('今日から次の8週間を始めます。テスト結果はリセットされます。よろしいですか？') && saveProgram(fresh(today))}>
          次の8週間を始める
        </Button>
        <Button variant="danger" onClick={() => window.confirm('プログラムを終了しますか？テスト結果も消えます。') && saveProgram(null)}>
          プログラムを終了
        </Button>
      </div>
    </>
  );
}

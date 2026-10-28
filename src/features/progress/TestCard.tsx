import { useState } from 'react';
import { Button } from '../../components/Button';
import { useBodyweights, useExerciseMap, useProgram, useRoutines } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import { toDateKey } from '../../lib/dates';
import { mainExerciseIds } from '../../lib/program';
import { TestSheet } from './TestSheet';
import s from './progress.module.css';

const kg = (v: number | null | undefined) => (v == null ? '–' : `${formatKg(v)}kg`);
function delta(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return '';
  const d = Math.round((b - a) * 100) / 100;
  return d > 0 ? `▲ ${formatKg(d)}kg` : d < 0 ? `▼ ${formatKg(-d)}kg` : '±0';
}

export function TestCard() {
  const program = useProgram();
  const routines = useRoutines();
  const exMap = useExerciseMap();
  const logs = useBodyweights();
  const [which, setWhich] = useState<'start' | 'end' | null>(null);
  if (!program || !routines || !exMap || !logs) return null;

  const mains = mainExerciseIds(routines).map((id) => exMap.get(id)).filter((e) => !!e);
  const { start, end } = program.tests;
  const today = logs.find((l) => l.date === toDateKey(Date.now()))?.kg ?? null;
  const rows = [
    ...mains.map((e) => ({ name: e.name, a: start?.lifts[e.id], b: end?.lifts[e.id] })),
    { name: '体重', a: start?.bodyweight, b: end?.bodyweight },
  ];

  return (
    <section aria-label="8週間テスト" className={s.testCard}>
      <div className="sec" style={{ marginTop: 0 }}>8週間テスト（5RM）</div>
      <table className={s.testTable}>
        <thead>
          <tr><th>項目</th><th>開始時</th><th>8週目</th><th>伸び</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = delta(r.a, r.b);
            return (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{kg(r.a)}</td>
                <td>{kg(r.b)}</td>
                <td className={d.startsWith('▲') ? s.up : d.startsWith('▼') ? s.down : undefined}>{d}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={s.testBtns}>
        <Button onClick={() => setWhich('start')}>開始時を入力</Button>
        <Button onClick={() => setWhich('end')}>8週目を入力</Button>
      </div>
      {which && <TestSheet which={which} program={program} exercises={mains} todayBodyweight={today} onClose={() => setWhich(null)} />}
    </section>
  );
}

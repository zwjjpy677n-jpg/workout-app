import { useState } from 'react';
import { Button } from '../../components/Button';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { saveProgram } from '../../db/repository';
import { toDateKey } from '../../lib/dates';
import type { Exercise, Program, TestResult } from '../../lib/types';
import s from './progress.module.css';

type Props = { which: 'start' | 'end'; program: Program; exercises: Exercise[]; todayBodyweight: number | null; onClose(): void };

export function TestSheet({ which, program, exercises, todayBodyweight, onClose }: Props) {
  const cur = program.tests[which];
  const [lifts, setLifts] = useState<Record<string, number | null>>(() => Object.fromEntries(exercises.map((e) => [e.id, cur?.lifts[e.id] ?? null])));
  const [bw, setBw] = useState<number | null>(cur?.bodyweight ?? todayBodyweight);

  async function save() {
    const result: TestResult = {
      date: toDateKey(Date.now()),
      bodyweight: bw,
      // 今はメイン種目でない種目の過去の値も残す。空欄にした種目は消す
      lifts: Object.fromEntries(
        Object.entries({ ...cur?.lifts, ...lifts }).filter((e): e is [string, number] => e[1] != null),
      ),
    };
    await saveProgram({ ...program, tests: { ...program.tests, [which]: result } });
    onClose();
  }

  return (
    <Sheet open title={which === 'start' ? '開始時のテスト' : '8週目のテスト'} onClose={onClose}>
      <p className={s.testNote}>5回挙がる最大の重さ（5RM）と体重を入れてください。</p>
      {exercises.map((e) => (
        <label key={e.id} className={s.testField}>
          <span>{e.name}</span>
          <NumberInput aria-label={`${e.name} 5RM`} value={lifts[e.id]} onChange={(v) => setLifts((l) => ({ ...l, [e.id]: v }))} min={0} max={1000} inputMode="decimal" placeholder="kg" />
        </label>
      ))}
      <label className={s.testField}>
        <span>体重</span>
        <NumberInput aria-label="体重" value={bw} onChange={setBw} min={20} max={300} inputMode="decimal" placeholder="kg" />
      </label>
      <div style={{ marginTop: 14 }}>
        <Button block variant="primary" onClick={save}>保存</Button>
      </div>
    </Sheet>
  );
}

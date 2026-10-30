import { useEffect, useRef, useState } from 'react';
import { Stepper } from '../../../../src/components/Stepper';
import { setValue, toggleCheck } from '../../db/repo';
import { applyValue } from '../../lib/schedule';
import type { Item, Log } from '../../lib/types';
import s from './today.module.css';

// 範囲外の入力は NumberInput が空扱いにして保存値を消してしまうので、上限は十分大きくする
const MAX = 99999;

export function RoutineRow({ item, log, date }: { item: Item; log: Log | undefined; date: string }) {
  const done = !!log?.done;
  if (item.kind === 'check') {
    return (
      <button type="button" role="checkbox" aria-checked={done} aria-label={item.name} className={`${s.row} ${done ? s.done : ''}`} onClick={() => void toggleCheck(date, item.id)}>
        <span className={s.box} aria-hidden="true">{done ? '✓' : ''}</span>
        <span className={s.name}>{item.name}</span>
      </button>
    );
  }
  return <NumberRow item={item} log={log} date={date} />;
}

const SAVE_DELAY = 400;

/**
 * 数値の項目。打っている途中は手元の値（draft）だけを変え、少し止まってから保存する。
 * 1文字ごとに保存すると、遅れて返ってきた古い値で入力中の文字が戻ることがあるため
 */
function NumberRow({ item, log, date }: { item: Item; log: Log | undefined; date: string }) {
  const saved = log?.value ?? null;
  const [draft, setDraft] = useState<number | null>(saved);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<{ date: string; value: number | null } | null>(null);

  const flush = () => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) void setValue(p.date, item, p.value);
  };

  // 保存し終えたあと、日付が変わったときや他の画面で直したときは、保存済みの値に合わせる
  useEffect(() => {
    if (!pending.current) setDraft(saved);
  }, [saved, date]);
  useEffect(() => flush, [date]);

  const change = (v: number | null) => {
    setDraft(v);
    pending.current = { date, value: v };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const target = item.target ?? 0;
  const done = applyValue(item, draft).done;
  return (
    <div className={`${s.row} ${s.numRow} ${done ? s.done : ''}`}>
      <span className={s.box} role="img" aria-label={`${item.name} ${done ? 'できた' : 'まだ'}`}>{done ? '✓' : ''}</span>
      <span className={s.name}>
        {item.name}
        <small className="muted">{`${draft ?? 0} / ${target} ${item.unit ?? ''}`.trim()}</small>
      </span>
      <div className={s.stepper} onBlur={flush}>
        <Stepper
          label={item.name}
          value={draft}
          onChange={change}
          step={item.step ?? 1}
          min={0}
          max={MAX}
          unit={item.unit ?? ''}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

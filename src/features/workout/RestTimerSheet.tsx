import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Stepper } from '../../components/Stepper';
import s from './rest.module.css';

const PRESETS = [30, 60, 90, 120, 180, 300];
const label = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

type Props = { open: boolean; initialSec: number; onStart(sec: number): void; onClose(): void };

/** レストタイマーの秒数を、プリセットか分・秒の入力で決めて開始する */
export function RestTimerSheet({ open, initialSec, onStart, onClose }: Props) {
  const [min, setMin] = useState<number | null>(Math.floor(initialSec / 60));
  const [sec, setSec] = useState<number | null>(initialSec % 60);

  useEffect(() => {
    if (!open) return;
    setMin(Math.floor(initialSec / 60));
    setSec(initialSec % 60);
  }, [open, initialSec]);

  const total = (min ?? 0) * 60 + (sec ?? 0);
  const start = (t: number) => {
    onStart(t);
    onClose();
  };

  return (
    <Sheet open={open} title="レストタイマー" onClose={onClose}>
      <div className={s.presets}>
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => start(p)}>{label(p)}</button>
        ))}
      </div>
      <div className={s.custom}>
        <Stepper label="分" unit="分" value={min} onChange={setMin} step={1} min={0} max={60} inputMode="numeric" />
        <Stepper label="秒" unit="秒" value={sec} onChange={setSec} step={5} min={0} max={59} inputMode="numeric" />
      </div>
      <Button block variant="primary" disabled={total <= 0} onClick={() => start(total)}>開始</Button>
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { useSettings } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import { platesFor } from '../../lib/tools';
import s from './tools.module.css';

export function PlateSheet({ open, onClose, initialKg }: { open: boolean; onClose(): void; initialKg: number }) {
  const settings = useSettings();
  const [kg, setKg] = useState<number | null>(initialKg);
  useEffect(() => setKg(initialKg), [initialKg, open]);

  const r = settings && kg != null ? platesFor(kg, settings.barKg, settings.plates) : null;
  const maxPlate = Math.max(1, ...(settings?.plates ?? [1]));

  return (
    <Sheet open={open} title="プレート計算" onClose={onClose}>
      <NumberInput aria-label="目標重量" value={kg} onChange={setKg} min={0} max={1000} inputMode="decimal" placeholder="目標重量 (kg)" />
      {r && settings && (
        <div className={s.result}>
          <div className={s.label}>片側に付けるプレート</div>
          <div className={s.plates}>{r.perSide.length ? r.perSide.map(formatKg).join(' + ') : 'なし（バーのみ）'}</div>
          <div className={s.viz} aria-hidden="true">
            {[...r.perSide].reverse().map((p, i) => <i key={`l${i}`} style={{ height: `${30 + (p / maxPlate) * 40}px` }} />)}
            <b />
            {r.perSide.map((p, i) => <i key={`r${i}`} style={{ height: `${30 + (p / maxPlate) * 40}px` }} />)}
          </div>
          {r.diffKg > 0 && <div className={s.warn}>最も近い: {formatKg(r.achievedKg)}kg（−{formatKg(r.diffKg)}kg）</div>}
          {r.diffKg < 0 && <div className={s.warn}>バー（{formatKg(settings.barKg)}kg）より軽い重量です</div>}
          <div className={s.bar}>バー {formatKg(settings.barKg)}kg ・ 設定は「管理 › 設定」</div>
        </div>
      )}
    </Sheet>
  );
}

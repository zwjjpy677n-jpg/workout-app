import { useEffect, useState } from 'react';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { useSettings } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import { platesFor } from '../../lib/tools';
import { PlateBar } from '../../components/PlateBar';
import s from './tools.module.css';

export function PlateSheet({ open, onClose, initialKg }: { open: boolean; onClose(): void; initialKg: number }) {
  const settings = useSettings();
  const [kg, setKg] = useState<number | null>(initialKg);
  useEffect(() => setKg(initialKg), [initialKg, open]);

  const r = settings && kg != null ? platesFor(kg, settings.barKg, settings.plates) : null;

  return (
    <Sheet open={open} title="プレート計算" onClose={onClose}>
      <NumberInput aria-label="目標重量" value={kg} onChange={setKg} min={0} max={1000} inputMode="decimal" placeholder="目標重量 (kg)" />
      {r && settings && (
        <div className={s.result}>
          <div className={s.label}>片側に付けるプレート</div>
          <div className={s.plates}>{r.perSide.length ? r.perSide.map(formatKg).join(' + ') : 'なし（バーのみ）'}</div>
          {kg != null && <PlateBar targetKg={kg} barKg={settings.barKg} plates={settings.plates} />}
          {r.diffKg > 0 && <div className={s.warn}>最も近い: {formatKg(r.achievedKg)}kg（−{formatKg(r.diffKg)}kg）</div>}
          {r.diffKg < 0 && <div className={s.warn}>バー（{formatKg(settings.barKg)}kg）より軽い重量です</div>}
          <div className={s.bar}>設定は「管理 › 設定」</div>
        </div>
      )}
    </Sheet>
  );
}

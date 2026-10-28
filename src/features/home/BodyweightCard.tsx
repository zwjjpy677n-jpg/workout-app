import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { setBodyweight } from '../../db/repository';
import { useBodyweights } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { formatKg } from '../../lib/calc';
import { toDateKey } from '../../lib/dates';
import s from './home.module.css';

const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0');
const diff1 = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? Math.round((a - b) * 10) / 10 : null);

export function BodyweightCard() {
  const logs = useBodyweights();
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [fatInvalid, setFatInvalid] = useState(false);
  const today = toDateKey(useToday());
  if (!logs) return null;

  const cur = logs.find((l) => l.date === today);
  const prev = [...logs].reverse().find((l) => l.date < today);
  const prevFat = [...logs].reverse().find((l) => l.date < today && l.fatPct != null)?.fatPct;
  const diff = diff1(cur?.kg, prev?.kg);
  const fatDiff = diff1(cur?.fatPct, prevFat);

  const edit = () => {
    setKg(cur?.kg ?? null);
    setFat(cur?.fatPct ?? null);
    setFatInvalid(false);
    setOpen(true);
  };

  return (
    <>
      <div className={s.bw}>
        {cur ? (
          <Card onClick={edit}>
            <div className={s.bwLabel}>今日の体重</div>
            <span className={s.bwVal}>{formatKg(cur.kg)}<small>kg</small></span>
            {diff != null && <span className={s.diff}>{signed(diff)}</span>}
            {cur.fatPct != null && (
              <div className={s.fatRow}>
                <span>体脂肪 {formatKg(cur.fatPct)}%</span>
                {fatDiff != null && <span className={s.diff}>{signed(fatDiff)}</span>}
              </div>
            )}
          </Card>
        ) : (
          <Button block onClick={edit}>体重を記録</Button>
        )}
      </div>
      <Sheet open={open} title="今日の体重" onClose={() => setOpen(false)}>
        <label className={s.bwField}>
          <span>体重（kg）</span>
          <NumberInput aria-label="体重(kg)" value={kg} onChange={setKg} min={20} max={300} inputMode="decimal" placeholder={prev ? formatKg(prev.kg) : 'kg'} autoFocus />
        </label>
        <label className={s.bwField}>
          <span>体脂肪率（%・任意、3〜60）</span>
          <NumberInput
            aria-label="体脂肪率(%)"
            value={fat}
            onChange={setFat}
            onInvalidChange={setFatInvalid}
            min={3}
            max={60}
            inputMode="decimal"
            placeholder={prevFat != null ? formatKg(prevFat) : '%'}
          />
        </label>
        <div style={{ marginTop: 14 }}>
          <Button
            block
            variant="primary"
            disabled={kg == null || kg < 20 || fatInvalid}
            onClick={async () => {
              if (kg != null) await setBodyweight(today, kg, fat);
              setOpen(false);
            }}
          >
            保存
          </Button>
        </div>
      </Sheet>
    </>
  );
}

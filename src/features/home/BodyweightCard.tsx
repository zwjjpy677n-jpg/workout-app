import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { setBodyweight } from '../../db/repository';
import { useBodyweights } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import { toDateKey } from '../../lib/dates';
import s from './home.module.css';

export function BodyweightCard() {
  const logs = useBodyweights();
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState<number | null>(null);
  if (!logs) return null;

  const today = toDateKey(Date.now());
  const cur = logs.find((l) => l.date === today);
  const prev = [...logs].reverse().find((l) => l.date < today);
  const diff = cur && prev ? Math.round((cur.kg - prev.kg) * 10) / 10 : null;

  const edit = () => {
    setKg(cur?.kg ?? null);
    setOpen(true);
  };

  return (
    <>
      <div className={s.bw}>
        {cur ? (
          <Card onClick={edit}>
            <div className={s.bwLabel}>今日の体重</div>
            <span className={s.bwVal}>{formatKg(cur.kg)}<small>kg</small></span>
            {diff != null && <span className={s.diff}>{diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'}</span>}
          </Card>
        ) : (
          <Button block onClick={edit}>体重を記録</Button>
        )}
      </div>
      <Sheet open={open} title="今日の体重" onClose={() => setOpen(false)}>
        <NumberInput aria-label="体重(kg)" value={kg} onChange={setKg} min={20} max={300} inputMode="decimal" placeholder={prev ? formatKg(prev.kg) : 'kg'} autoFocus />
        <div style={{ marginTop: 14 }}>
          <Button
            block
            variant="primary"
            disabled={kg == null || kg < 20}
            onClick={async () => {
              if (kg != null) await setBodyweight(today, kg);
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

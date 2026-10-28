import { useState } from 'react';
import { Button } from '../../components/Button';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { deleteBodyweight, setBodyweight } from '../../db/repository';
import { useBodyweights } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import type { BodyweightLog } from '../../lib/types';
import s from './manage.module.css';

export function BodyweightList() {
  const logs = useBodyweights();
  const [editing, setEditing] = useState<BodyweightLog | null>(null);
  const [kg, setKg] = useState<number | null>(null);

  const open = (l: BodyweightLog) => {
    setEditing(l);
    setKg(l.kg);
  };

  return (
    <>
      <div className={s.list}>
        {logs?.length === 0 && <p className={s.empty}>体重はホーム画面から記録できます</p>}
        {[...(logs ?? [])].reverse().map((l) => (
          <button key={l.date} type="button" className={s.item} onClick={() => open(l)}>
            <span className="muted">{l.date.replaceAll('-', '/')}</span>
            <span className="num">{formatKg(l.kg)}kg</span>
          </button>
        ))}
      </div>
      <Sheet open={!!editing} title={`体重 ${editing?.date ?? ''}`} onClose={() => setEditing(null)}>
        <NumberInput value={kg} onChange={setKg} min={20} max={300} inputMode="decimal" aria-label="体重(kg)" />
        <div className={s.actions}>
          <Button
            variant="danger"
            onClick={async () => {
              if (editing && window.confirm('この記録を削除しますか？')) {
                await deleteBodyweight(editing.date);
                setEditing(null);
              }
            }}
          >
            削除
          </Button>
          <Button
            variant="primary"
            disabled={kg == null || kg < 20}
            onClick={async () => {
              if (editing && kg != null) await setBodyweight(editing.date, kg);
              setEditing(null);
            }}
          >
            保存
          </Button>
        </div>
      </Sheet>
    </>
  );
}

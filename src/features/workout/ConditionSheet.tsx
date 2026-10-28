import { Button } from '../../components/Button';
import { RatingInput } from '../../components/RatingInput';
import { Sheet } from '../../components/Sheet';
import type { Condition } from '../../lib/types';

type Props = { open: boolean; value: Condition; onChange(c: Condition): void; onClose(): void };

export function ConditionSheet({ open, value, onChange, onClose }: Props) {
  const filled = value.sleep != null || value.fatigue != null || value.motivation != null;
  return (
    <Sheet open={open} title="コンディション" onClose={onClose}>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>1（悪い）〜 5（良い）。あとで振り返りに使えます。</p>
      <RatingInput label="睡眠" value={value.sleep} onChange={(sleep) => onChange({ ...value, sleep })} />
      <RatingInput label="疲労感（5=元気）" value={value.fatigue} onChange={(fatigue) => onChange({ ...value, fatigue })} />
      <RatingInput label="やる気" value={value.motivation} onChange={(motivation) => onChange({ ...value, motivation })} />
      <div style={{ marginTop: 16 }}>
        <Button block variant={filled ? 'primary' : 'ghost'} onClick={onClose}>{filled ? 'OK' : 'スキップ'}</Button>
      </div>
    </Sheet>
  );
}

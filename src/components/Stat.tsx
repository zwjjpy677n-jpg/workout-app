import { Card } from './Card';
import s from './Stat.module.css';

export function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <Card>
      <div className={s.v}>{value}{unit && <small>{unit}</small>}</div>
      <div className={s.k}>{label}</div>
    </Card>
  );
}

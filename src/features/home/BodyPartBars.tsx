import { BODY_PART_LABEL, BODY_PARTS, type BodyPart } from '../../lib/types';
import s from './home.module.css';

export function BodyPartBars({ counts }: { counts: Record<BodyPart, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  const parts = BODY_PARTS.filter((b) => b !== 'other' || counts.other > 0);
  return (
    <section aria-label="部位別セット数" className={s.bars}>
      {parts.map((b) => (
        <div key={b} className={`${s.barRow} ${counts[b] === 0 ? s.zero : ''}`}>
          <span>{BODY_PART_LABEL[b]}</span>
          <div className={s.track}><i style={{ width: `${(counts[b] / max) * 100}%` }} /></div>
          <span className={s.cnt}>{counts[b]}</span>
        </div>
      ))}
    </section>
  );
}

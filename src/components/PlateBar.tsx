import { formatKg } from '../lib/calc';
import { PLATE_COLORS, platesFor } from '../lib/tools';
import s from './PlateBar.module.css';

/** 片側のプレート図。重いプレートほど高く描く */
export function PlateBar({ targetKg, barKg, plates }: { targetKg: number; barKg: number; plates: number[] }) {
  if (targetKg < barKg) return null;
  const r = platesFor(targetKg, barKg, plates);
  const max = Math.max(1, ...plates);
  let x = 4;
  const rects = r.perSide.map((p, i) => {
    const h = 16 + (p / max) * 30;
    const w = 6 + (p / max) * 6;
    const el = (
      <rect key={i} data-plate={formatKg(p)} x={x} y={25 - h / 2} width={w} height={h} rx={2} fill={PLATE_COLORS[formatKg(p)] ?? '#8B8B94'} stroke="#2A2A31" strokeWidth={0.6} />
    );
    x += w + 2;
    return el;
  });
  const width = x + 28;
  const text = `${r.perSide.length ? `片側 ${r.perSide.map(formatKg).join(' + ')}` : 'バーのみ'} ・ バー${formatKg(barKg)}kg${r.diffKg > 0 ? `（端数 ${formatKg(r.diffKg)}kg）` : ''}`;
  return (
    <div className={s.wrap}>
      <svg width={width} height={50} viewBox={`0 0 ${width} 50`} aria-hidden="true">
        <rect x={0} y={22} width={width} height={6} rx={2} fill="#6B7480" />
        {rects}
      </svg>
      <span className={s.label}>{text}</span>
    </div>
  );
}

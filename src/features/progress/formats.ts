import { formatDuration, formatKg, formatVolume } from '../../lib/calc';
import type { Metric } from '../../lib/progress';

export type Fmt = { value(v: number): string; unit: string; delta(v: number): string };

export const kg1 = (v: number) => formatKg(Math.round(v * 10) / 10);
export const FORMATS: Record<Metric | 'bw' | 'fat', Fmt> = {
  fat: { value: kg1, unit: '%', delta: (v) => `${kg1(v)}%` },
  e1rm: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  maxWeight: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  maxAdded: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  bw: { value: kg1, unit: 'kg', delta: (v) => `${kg1(v)}kg` },
  volume: { value: formatVolume, unit: '', delta: formatVolume },
  totalReps: { value: String, unit: '回', delta: (v) => `${v}回` },
  maxTime: { value: formatDuration, unit: '', delta: formatDuration },
  totalTime: { value: formatDuration, unit: '', delta: formatDuration },
};

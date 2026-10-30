import { fromDateKey, toDateKey } from '../../../src/lib/dates';

export function addDays(date: string, n: number): string {
  const d = fromDateKey(date);
  d.setDate(d.getDate() + n);
  return toDateKey(d.getTime());
}

/** 0=日〜6=土 */
export function weekday(date: string): number {
  return fromDateKey(date).getDay();
}

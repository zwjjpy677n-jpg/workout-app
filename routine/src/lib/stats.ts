import { toDateKey } from '../../../src/lib/dates';
import { addDays } from './day';
import { itemsForDay } from './schedule';
import type { Item, Log } from './types';

/** やる項目が0件の日は null（カレンダーは色なし、連続日数は途切れも数えもしない） */
export type DayResult = { done: number; total: number } | null;

function byDate(logs: Log[]): Map<string, Log[]> {
  const m = new Map<string, Log[]>();
  for (const l of logs) {
    const list = m.get(l.date);
    if (list) list.push(l);
    else m.set(l.date, [l]);
  }
  return m;
}

function resultOf(items: Item[], logsOfDay: Log[], date: string, today: string): DayResult {
  const due = itemsForDay(items, date, logsOfDay, today);
  if (due.length === 0) return null;
  const done = new Set(logsOfDay.filter((l) => l.done).map((l) => l.itemId));
  return { done: due.filter((it) => done.has(it.id)).length, total: due.length };
}

export function dayResult(items: Item[], logs: Log[], date: string, today: string): DayResult {
  return resultOf(items, logs.filter((l) => l.date === date), date, today);
}

const complete = (r: DayResult) => r != null && r.done === r.total;

/** さかのぼる下限: いちばん古い項目を作った日 */
function firstDate(items: Item[]): string | null {
  if (items.length === 0) return null;
  return toDateKey(Math.min(...items.map((it) => it.createdAt)));
}

/** 今日から過去へ、全部できた日が続いた日数。今日が未完了なら昨日から数える */
export function currentStreak(items: Item[], logs: Log[], today: string): number {
  const first = firstDate(items);
  if (!first) return 0;
  const map = byDate(logs);
  let n = 0;
  for (let d = today; d >= first; d = addDays(d, -1)) {
    const r = resultOf(items, map.get(d) ?? [], d, today);
    if (r == null) continue;
    if (complete(r)) n++;
    else if (d !== today) break;
  }
  return n;
}

export function longestStreak(items: Item[], logs: Log[], today: string): number {
  const first = firstDate(items);
  if (!first) return 0;
  const map = byDate(logs);
  let best = 0;
  let run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const r = resultOf(items, map.get(d) ?? [], d, today);
    if (r == null) continue;
    if (complete(r)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return best;
}

/** 期間（両端含む）の できた数の合計 ÷ やる数の合計。分母0なら null */
export function rangeRate(items: Item[], logs: Log[], from: string, to: string, today: string): number | null {
  const map = byDate(logs);
  let done = 0;
  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = resultOf(items, map.get(d) ?? [], d, today);
    if (r) {
      done += r.done;
      total += r.total;
    }
  }
  return total === 0 ? null : done / total;
}

export function itemRate(item: Item, logs: Log[], from: string, to: string, today: string): number | null {
  return rangeRate([item], logs.filter((l) => l.itemId === item.id), from, to, today);
}

/** カレンダーの色: 〜49% → 1、50〜99% → 2、100% → 3 */
export function rateLevel(rate: number): 1 | 2 | 3 {
  if (rate >= 1) return 3;
  return rate >= 0.5 ? 2 : 1;
}

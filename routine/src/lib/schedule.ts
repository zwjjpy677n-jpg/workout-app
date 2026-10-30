import { fromDateKey } from '../../../src/lib/dates';
import { addDays, weekday } from './day';
import { SLOTS, type Item, type Log } from './types';

const SLOT_ORDER = new Map(SLOTS.map((s, i) => [s.key, i]));

/** その日にやる項目（時間帯の順 → order の順）。logsOfDay はその日の記録 */
export function itemsForDay(items: Item[], date: string, logsOfDay: Log[], today: string): Item[] {
  const end = fromDateKey(addDays(date, 1)).getTime();
  const wd = weekday(date);
  const logged = new Set(logsOfDay.map((l) => l.itemId));
  return items
    .filter((it) => {
      if (!it.days.includes(wd) || it.createdAt >= end) return false;
      // 消した当日からは出さない
      if (it.deletedAt != null && it.deletedAt < end) return false;
      if (it.active) return true;
      // 休止中: 休止した時刻は持たないので、過去の日は記録が残っている日だけ数える
      return date < today && logged.has(it.id);
    })
    .sort((a, b) => SLOT_ORDER.get(a.slot)! - SLOT_ORDER.get(b.slot)! || a.order - b.order);
}

/** 数値を入れたときの記録。空にしたら value を消して、できていないに戻す */
export function applyValue(item: Item, value: number | null): { done: boolean; value?: number } {
  if (item.kind !== 'number' || value == null) return { done: false };
  return { done: item.target != null && value >= item.target, value };
}

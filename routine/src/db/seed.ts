import type { Item } from '../lib/types';
import { db } from './db';

const EVERY = [0, 1, 2, 3, 4, 5, 6];

export const SEED: Omit<Item, 'id' | 'createdAt' | 'order' | 'active'>[] = [
  { name: '体重をはかる', slot: 'morning', days: EVERY, kind: 'check' },
  { name: '水を飲む', slot: 'morning', days: EVERY, kind: 'number', target: 1500, unit: 'ml', step: 250 },
  { name: 'アップ・動的ストレッチ', slot: 'pre', days: EVERY, kind: 'check' },
  { name: 'プロテインをとる', slot: 'post', days: EVERY, kind: 'check' },
  { name: '静的ストレッチ', slot: 'night', days: EVERY, kind: 'check' },
  { name: '睡眠', slot: 'night', days: EVERY, kind: 'number', target: 7.5, unit: '時間', step: 0.5 },
];

/** 最初の1回だけ参考の項目を入れる（全部消したあとに開き直しても入れ直さない） */
export function seedIfEmpty(now: number): Promise<void> {
  return db.transaction('rw', db.meta, db.items, async () => {
    if (await db.meta.get('seeded')) return;
    const order = new Map<string, number>();
    await db.items.bulkAdd(
      SEED.map((s) => {
        const n = order.get(s.slot) ?? 0;
        order.set(s.slot, n + 1);
        return { ...s, id: crypto.randomUUID(), order: n, active: true, createdAt: now };
      }),
    );
    await db.meta.put({ key: 'seeded', at: now });
  });
}

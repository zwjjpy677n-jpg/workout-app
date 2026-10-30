import { applyValue } from '../lib/schedule';
import type { Item, Log, Todo } from '../lib/types';
import { db } from './db';

export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'order' | 'active' | 'deletedAt'> & { id?: string };

/** 新規は時間帯の末尾に足す。id 付きは上書き（作った時刻・並び順・休止はそのまま） */
export function saveItem(input: ItemInput, now: number): Promise<string> {
  return db.transaction('rw', db.items, async () => {
    const prev = input.id ? await db.items.get(input.id) : undefined;
    if (prev) {
      // 数値の欄（target/unit/step）は入力どおりに置き換える（チェックに変えたら古い目標を残さない）
      const { id, order, active, createdAt, deletedAt } = prev;
      await db.items.put({ ...input, id, order, active, createdAt, deletedAt });
      return id;
    }
    const sameSlot = (await db.items.toArray()).filter((it) => it.slot === input.slot && it.deletedAt == null);
    const id = crypto.randomUUID();
    await db.items.add({ ...input, id, order: sameSlot.length, active: true, createdAt: now });
    return id;
  });
}

export async function setItemActive(id: string, active: boolean): Promise<void> {
  await db.items.update(id, { active });
}

/** 行は残して deletedAt を入れる（過去の記録の分母に使う） */
export async function deleteItem(id: string, now: number): Promise<void> {
  await db.items.update(id, { deletedAt: now });
}

/** 並びの中で隣と入れ替え、0 から振り直す（order が重なっていても確実に動く） */
async function swapWith<T extends { id: string; order: number }>(list: T[], id: string, dir: -1 | 1, put: (id: string, order: number) => Promise<unknown>) {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  await Promise.all(sorted.map((x, n) => put(x.id, n)));
}

export function moveItem(id: string, dir: -1 | 1): Promise<void> {
  return db.transaction('rw', db.items, async () => {
    const me = await db.items.get(id);
    if (!me) return;
    const list = (await db.items.toArray()).filter((it) => it.slot === me.slot && it.deletedAt == null);
    await swapWith(list, id, dir, (x, order) => db.items.update(x, { order }));
  });
}

const logId = (date: string, itemId: string) => `${date}:${itemId}`;

export function toggleCheck(date: string, itemId: string): Promise<void> {
  return db.transaction('rw', db.logs, async () => {
    const id = logId(date, itemId);
    const prev = await db.logs.get(id);
    await db.logs.put({ id, date, itemId, done: !prev?.done });
  });
}

export async function setValue(date: string, item: Item, value: number | null): Promise<void> {
  const log: Log = { id: logId(date, item.id), date, itemId: item.id, ...applyValue(item, value) };
  await db.logs.put(log);
}

export function addTodo(date: string, text: string): Promise<void> {
  const t = text.trim();
  if (!t) return Promise.resolve();
  return db.transaction('rw', db.todos, async () => {
    const n = await db.todos.where('date').equals(date).count();
    await db.todos.add({ id: crypto.randomUUID(), date, text: t, done: false, order: n });
  });
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'done'>>): Promise<void> {
  await db.todos.update(id, patch);
}

export async function deleteTodo(id: string): Promise<void> {
  await db.todos.delete(id);
}

export function moveTodo(id: string, dir: -1 | 1): Promise<void> {
  return db.transaction('rw', db.todos, async () => {
    const me = await db.todos.get(id);
    if (!me) return;
    const list = await db.todos.where('date').equals(me.date).toArray();
    await swapWith(list, id, dir, (x, order) => db.todos.update(x, { order }));
  });
}

/** 今日より前の、できていないやること（古い日付順） */
export async function pendingBefore(today: string): Promise<Todo[]> {
  const list = await db.todos.where('date').below(today).toArray();
  return list.filter((t) => !t.done).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
}

/** 今日に移す（複製しない）。元の日付は carriedFrom に残す */
export function carryOver(ids: string[], today: string): Promise<void> {
  return db.transaction('rw', db.todos, async () => {
    let n = await db.todos.where('date').equals(today).count();
    for (const id of ids) {
      const t = await db.todos.get(id);
      if (!t || t.date >= today) continue;
      await db.todos.update(id, { date: today, carriedFrom: t.carriedFrom ?? t.date, order: n++ });
    }
  });
}

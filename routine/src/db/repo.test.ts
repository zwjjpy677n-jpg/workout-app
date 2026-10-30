import { db } from './db';
import { SEED, seedIfEmpty } from './seed';
import {
  addTodo, carryOver, deleteItem, moveItem, pendingBefore, saveItem, setValue, toggleCheck,
} from './repo';

const NOW = new Date(2026, 9, 30, 9).getTime();
const EVERY = [0, 1, 2, 3, 4, 5, 6];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('seedIfEmpty', () => {
  test('何度呼んでも6件。全部消したあとも増えない', async () => {
    await Promise.all([seedIfEmpty(NOW), seedIfEmpty(NOW)]);
    await seedIfEmpty(NOW);
    expect(await db.items.count()).toBe(6);
    for (const it of await db.items.toArray()) await deleteItem(it.id, NOW);
    await seedIfEmpty(NOW);
    expect(await db.items.count()).toBe(6);
  });

  test('参考の中身', () => {
    expect(SEED).toHaveLength(6);
    expect(SEED.find((s) => s.name === '水を飲む')).toMatchObject({ slot: 'morning', kind: 'number', target: 1500, unit: 'ml', step: 250 });
    expect(SEED.find((s) => s.name === '睡眠')).toMatchObject({ slot: 'night', kind: 'number', target: 7.5, unit: '時間', step: 0.5 });
    expect(SEED.filter((s) => s.kind === 'check')).toHaveLength(4);
    expect(SEED.every((s) => s.days.join() === EVERY.join())).toBe(true);
  });
});

describe('saveItem', () => {
  test('新規は時間帯の末尾・使用中。id 付きは上書きして createdAt と order を保つ', async () => {
    const a = await saveItem({ name: 'A', slot: 'night', days: EVERY, kind: 'check' }, NOW);
    const b = await saveItem({ name: 'B', slot: 'night', days: EVERY, kind: 'check' }, NOW + 1);
    expect(await db.items.get(b)).toMatchObject({ order: 1, active: true, createdAt: NOW + 1 });
    await saveItem({ id: a, name: 'A2', slot: 'night', days: [1], kind: 'check' }, NOW + 99);
    expect(await db.items.get(a)).toMatchObject({ name: 'A2', days: [1], order: 0, createdAt: NOW });
  });
});

test('moveItem は同じ時間帯の隣と入れ替え、端では何もしない', async () => {
  const a = await saveItem({ name: 'A', slot: 'morning', days: EVERY, kind: 'check' }, NOW);
  const b = await saveItem({ name: 'B', slot: 'morning', days: EVERY, kind: 'check' }, NOW);
  await saveItem({ name: 'N', slot: 'night', days: EVERY, kind: 'check' }, NOW);
  await moveItem(b, -1);
  expect((await db.items.get(a))!.order).toBe(1);
  expect((await db.items.get(b))!.order).toBe(0);
  await moveItem(b, -1);
  expect((await db.items.get(b))!.order).toBe(0);
});

test('toggleCheck を2回押すと戻る', async () => {
  await toggleCheck('2026-10-30', 'x');
  expect(await db.logs.get('2026-10-30:x')).toMatchObject({ done: true, date: '2026-10-30', itemId: 'x' });
  await toggleCheck('2026-10-30', 'x');
  expect((await db.logs.get('2026-10-30:x'))!.done).toBe(false);
});

test('setValue は目標で done、空で値を消す', async () => {
  const id = await saveItem({ name: '水', slot: 'morning', days: EVERY, kind: 'number', target: 1500, unit: 'ml', step: 250 }, NOW);
  const water = (await db.items.get(id))!;
  await setValue('2026-10-30', water, 1500);
  expect(await db.logs.get(`2026-10-30:${id}`)).toMatchObject({ done: true, value: 1500 });
  await setValue('2026-10-30', water, null);
  const l = (await db.logs.get(`2026-10-30:${id}`))!;
  expect(l.done).toBe(false);
  expect('value' in l).toBe(false);
});

test('空白だけのやることは追加しない', async () => {
  await addTodo('2026-10-30', '  ');
  expect(await db.todos.count()).toBe(0);
});

test('pendingBefore と carryOver', async () => {
  await addTodo('2026-10-28', '古い');
  await addTodo('2026-10-29', '昨日の未完了');
  await addTodo('2026-10-29', '昨日の完了');
  await addTodo('2026-10-30', '今日');
  await addTodo('2026-10-30', '今日2');
  const done = (await db.todos.toArray()).find((t) => t.text === '昨日の完了')!;
  await db.todos.update(done.id, { done: true });

  const pending = await pendingBefore('2026-10-30');
  expect(pending.map((t) => t.text)).toEqual(['古い', '昨日の未完了']);

  await carryOver([pending[1].id], '2026-10-30');
  expect(await db.todos.count()).toBe(5);
  expect(await db.todos.get(pending[1].id)).toMatchObject({ date: '2026-10-30', carriedFrom: '2026-10-29', order: 2 });
  expect((await pendingBefore('2026-10-30')).map((t) => t.text)).toEqual(['古い']);
});

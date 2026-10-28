import { resetDb } from './db';
import { addExercise, listExercises, listRoutines, removeExercise, saveRoutine, startWorkout } from './repository';
import { ensureMenuSeeded, loadReferenceMenu, REFERENCE_MENU } from './menuSeed';
import { ensureSeeded } from './seed';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

test('ensureMenuSeeded: 4ルーティン、曜日、既存種目の再利用、冪等', async () => {
  await ensureMenuSeeded();
  await ensureMenuSeeded();
  const rs = await listRoutines();
  expect(rs.map((r) => [r.name, r.weekday, r.items.length])).toEqual([
    ['脚・筋力', 1, 8], ['上半身・筋肥大', 2, 11], ['脚・瞬発', 3, 8], ['上半身・瞬発', 5, 9],
  ]);
  const ex = await listExercises();
  expect(ex.filter((e) => e.name === 'スクワット')).toHaveLength(1);
  expect(ex.some((e) => e.name === 'ベントオーバーロー')).toBe(false);
  expect(ex.find((e) => e.name === 'ヘックスバーデッドリフト')).toMatchObject({ barKg: 25, restSec: 180, type: 'weight', bodyPart: 'legs' });
  expect(ex.find((e) => e.name === '片脚バランス')).toMatchObject({ type: 'time', bodyPart: 'core', restSec: 30 });
  const name = (id: string) => ex.find((e) => e.id === id)?.name;
  expect(rs[3].items.find((i) => name(i.exerciseId) === 'ピンベンチ')).toMatchObject({ main: true, inc: 1.25, reps: '5', sets: 3, note: 'ピンの上で1秒止めてから押す' });
  expect(rs[3].items[0]).toMatchObject({ sets: 1, reps: '6〜8本' });
  expect(rs[1].items.map((i) => name(i.exerciseId))).toContain('ベントオーバーロウ');
});

test('REFERENCE_MENU のメイン種目は3つ', () => {
  expect(REFERENCE_MENU.flatMap((d) => d.items.filter((i) => i.main).map((i) => i.name))).toEqual(['スクワット', 'ヘックスバーデッドリフト', 'ピンベンチ']);
});

test('ルーティンが既にあれば自動投入しない', async () => {
  await saveRoutine({ name: 'X', weekday: null, items: [] });
  await ensureMenuSeeded();
  expect(await listRoutines()).toHaveLength(1);
});

test('一度投入済みなら、ルーティンを全部消しても再投入しない', async () => {
  await ensureMenuSeeded();
  const { db } = await import('./db');
  await db.routines.clear();
  await ensureMenuSeeded();
  expect(await listRoutines()).toHaveLength(0);
});

test('loadReferenceMenu は追加し同名に(2)を付け、アーカイブ済みの同名は再利用しない', async () => {
  await ensureMenuSeeded();
  const squat = (await listExercises()).find((e) => e.name === 'スクワット')!;
  await startWorkout({ name: 'X', exerciseIds: [squat.id] });
  await removeExercise(squat.id);
  await loadReferenceMenu();
  const names = (await listRoutines()).map((r) => r.name);
  expect(names).toContain('脚・筋力(2)');
  expect(names).toHaveLength(8);
  expect((await listExercises()).filter((e) => e.name === 'スクワット')).toHaveLength(1);
  expect((await listExercises({ includeArchived: true })).filter((e) => e.name === 'スクワット')).toHaveLength(2);
});

test('同名の自作種目があれば再利用する', async () => {
  await addExercise({ name: 'ハイプル', bodyPart: 'back', type: 'weight', restSec: 60, barKg: null });
  await loadReferenceMenu();
  expect((await listExercises()).filter((e) => e.name === 'ハイプル')).toHaveLength(1);
});

test('同じ時刻に作っても曜日順に並ぶ', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 10));
  try {
    for (let k = 0; k < 5; k++) {
      await resetDb();
      await loadReferenceMenu();
      expect((await listRoutines()).map((r) => r.weekday)).toEqual([1, 2, 3, 5]);
    }
  } finally {
    vi.useRealTimers();
  }
});

test('同時に2回呼ばれても（2つのタブ）二重に入らない', async () => {
  await Promise.all([ensureMenuSeeded(), ensureMenuSeeded()]);
  expect(await listRoutines()).toHaveLength(4);
});

test('途中で失敗したら何も残らず、次回やり直せる', async () => {
  const { db } = await import('./db');
  const spy = vi.spyOn(db.routines, 'put').mockImplementationOnce((async (r: unknown) => { await db.routines.add(r as never); throw new Error('boom'); }) as never);
  await expect(ensureMenuSeeded()).rejects.toThrow('boom');
  spy.mockRestore();
  expect(await listRoutines()).toHaveLength(0);
  expect(await db.settings.get('menuSeeded')).toBeUndefined();
  await ensureMenuSeeded();
  expect(await listRoutines()).toHaveLength(4);
});

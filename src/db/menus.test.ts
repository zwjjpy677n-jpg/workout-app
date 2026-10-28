import { entry, set, wk } from '../test/factories';
import type { MenuPayload } from '../lib/share/menuPayload';
import { db, resetDb } from './db';
import { saveProfileName } from './friends';
import { importMenu, listMenuLog, logSentMenu, previewMenu } from './menus';
import { addExercise, getWorkout, listExercises, listRoutines, saveRoutine, saveWorkout } from './repository';
import { item } from '../test/factories';

let me = { id: '', name: '' };
let benchId = '';
beforeEach(async () => {
  await resetDb();
  me = await saveProfileName('たろう');
  benchId = (await addExercise({ name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 180, barKg: 20 })).id;
});

const payload = (o: Partial<MenuPayload> = {}): MenuPayload => ({
  id: 'friend000001', n: 'じろう', to: me.id, at: 100, mid: 'menu00000001', name: 'PUSH', weekday: 1,
  items: [
    [' ベンチプレス ', 0, 0, 75, 4, '5', 1, 2.5, '止める'],
    ['ディップス', 0, 1, 90, 3, '10', 0, 2.5, ''],
  ],
  ...o,
});

test('名前が前後の空白違いの種目を使い、無い種目だけ作る。既存種目のレストは変えない', async () => {
  expect(await previewMenu(payload())).toEqual({ mine: true, received: false, newExercises: ['ディップス'], sameName: null });
  const r = await importMenu(payload(), 'add', 1000);
  const exs = await listExercises();
  const dips = exs.find((e) => e.name === 'ディップス')!;
  expect(dips).toMatchObject({ bodyPart: 'chest', type: 'bodyweight', restSec: 90, barKg: null });
  expect(exs.find((e) => e.id === benchId)?.restSec).toBe(180);
  expect(r).toMatchObject({ name: 'PUSH', weekday: 1 });
  expect(r.items).toEqual([
    { exerciseId: benchId, sets: 4, reps: '5', main: true, inc: 2.5, note: '止める', restSec: 75 },
    { exerciseId: dips.id, sets: 3, reps: '10', main: false, inc: 2.5, note: '', restSec: 90 },
  ]);
  expect((await listMenuLog('received')).map((l) => [l.friendName, l.menu.mid, l.result])).toEqual([['じろう', 'menu00000001', 'added']]);
  expect((await previewMenu(payload())).received).toBe(true);
});

test('同じ名前のメニューを置き換えると ID は同じで中身が変わり、過去の記録は変わらない', async () => {
  const old = await saveRoutine({ name: 'PUSH', weekday: 3, items: [item(benchId, { sets: 3, reps: '8' })] });
  const done = wk(new Date(2026, 9, 20, 18), [{ ...entry(benchId, [set({ weight: 80, reps: 8 })]), target: { sets: 3, reps: '8', main: false, inc: 2.5, note: '', restSec: null } }], { routineId: old.id });
  await saveWorkout(done);
  expect((await previewMenu(payload())).sameName?.id).toBe(old.id);
  const r = await importMenu(payload({ mid: 'menu00000002' }), 'replace', 2000);
  expect(r.id).toBe(old.id);
  expect(r.createdAt).toBe(old.createdAt);
  const rs = await listRoutines();
  expect(rs).toHaveLength(1);
  expect(rs[0]).toMatchObject({ weekday: 1, items: [expect.objectContaining({ sets: 4, restSec: 75 }), expect.objectContaining({ reps: '10' })] });
  expect(await getWorkout(done.id)).toEqual(done);
  expect((await listMenuLog('received'))[0].result).toBe('replaced');
});

test('送った履歴は友達ごとに新しい順', async () => {
  await logSentMenu({ id: 'f1', name: 'じろう' }, payload({ mid: 'a00000000001', to: 'f1' }), 10);
  await logSentMenu({ id: 'f1', name: 'じろう' }, payload({ mid: 'a00000000002', to: 'f1', name: 'PULL' }), 20);
  await logSentMenu({ id: 'f2', name: 'さぶろう' }, payload({ mid: 'a00000000003', to: 'f2' }), 30);
  expect((await listMenuLog('sent', 'f1')).map((l) => l.menu.name)).toEqual(['PULL', 'PUSH']);
  expect(await db.table('menuLog').count()).toBe(3);
});

test('宛先違いは mine: false', async () => {
  expect((await previewMenu(payload({ to: 'someoneelse1' }))).mine).toBe(false);
});

test('同じメニューを続けて2回保存しても（ダブルタップ）、メニューは1つ', async () => {
  await Promise.all([importMenu(payload(), 'add', 1), importMenu(payload(), 'add', 2)]);
  expect((await listRoutines()).filter((r) => r.name === 'PUSH')).toHaveLength(1);
  expect(await listMenuLog('received')).toHaveLength(1);
});

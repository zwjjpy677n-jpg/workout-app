import { entry, ex, set, wk } from '../test/factories';
import { buildSharePayload, type SharePayload } from '../lib/share/sharePayload';
import type { Workout } from '../lib/types';
import { db, resetDb } from './db';
import { deleteFriend, getFriend, getProfile, listFriends, listFriendWorkouts, previewImport, saveImportedShare, saveProfileName } from './friends';
import { exportAll, importAll, listWorkouts, saveWorkout } from './repository';

const NOW = new Date(2026, 9, 28, 20).getTime();
const DAY = 86400_000;
const bench = ex('bench-uuid-0001', { name: 'ベンチプレス' });
const w = (id: string, daysAgo: number, weight: number) => wk(NOW - daysAgo * DAY, [entry(bench.id, [set({ weight, reps: 5 })])], { id });
const share = (workouts: Workout[], o: { id?: string; name?: string; at?: number } = {}): SharePayload =>
  buildSharePayload({ profile: { id: o.id ?? 'friend000001', name: o.name ?? 'たろう' }, exercises: [bench], routines: [], workouts }, o.at ?? NOW);

beforeEach(() => resetDb());

test('同じリンクを2回保存しても記録は重複しない', async () => {
  const p = share([w('aaaaaaaa-1', 3, 80), w('bbbbbbbb-1', 1, 82.5)]);
  await saveImportedShare(p, NOW);
  await saveImportedShare(p, NOW + 1);
  expect(await listFriendWorkouts('friend000001')).toHaveLength(2);
});

test('新しいリンクで記録が増え、送られてこなかった古い記録は残る', async () => {
  await saveImportedShare(share([w('aaaaaaaa-1', 10, 80), w('bbbbbbbb-1', 8, 80)]), NOW);
  await saveImportedShare(share([w('bbbbbbbb-1', 8, 85), w('cccccccc-1', 1, 90)], { at: NOW + DAY }), NOW + DAY);
  const ws = await listFriendWorkouts('friend000001');
  expect(ws.map((x) => [x.id, x.entries[0].sets[0].weight])).toEqual([
    ['friend000001:cccccccc', 90],
    ['friend000001:bbbbbbbb', 85],
    ['friend000001:aaaaaaaa', 80],
  ]);
  expect((await getFriend('friend000001'))?.receivedAt).toBe(NOW + DAY);
});

test('古いリンクを後から貼ると記録だけ増え、名前や種目は新しい方のまま', async () => {
  await saveImportedShare(share([w('bbbbbbbb-1', 1, 85)], { name: '新しい名前', at: NOW }), NOW);
  await saveImportedShare(share([w('aaaaaaaa-1', 20, 80)], { name: '古い名前', at: NOW - 7 * DAY }), NOW + 10);
  const f = await getFriend('friend000001');
  expect(f?.name).toBe('新しい名前');
  expect(f?.sharedAt).toBe(Math.floor(NOW / 60000) * 60000);
  expect(f?.receivedAt).toBe(NOW + 10);
  expect(await listFriendWorkouts('friend000001')).toHaveLength(2);
});

test('名前が同じでも ID が違えば別の友達、一覧は受け取りの新しい順で最後の日と件数つき', async () => {
  await saveImportedShare(share([w('aaaaaaaa-1', 3, 80)], { id: 'friend000001' }), NOW);
  await saveImportedShare(share([w('bbbbbbbb-1', 1, 80), w('cccccccc-1', 2, 80)], { id: 'friend000002' }), NOW + 5);
  const list = await listFriends();
  expect(list.map((f) => [f.id, f.name, f.count, f.lastAt])).toEqual([
    ['friend000002', 'たろう', 2, Math.floor((NOW - DAY) / 60000) * 60000],
    ['friend000001', 'たろう', 1, Math.floor((NOW - 3 * DAY) / 60000) * 60000],
  ]);
});

test('受け取る前の確認: 初めて／新しい記録の数', async () => {
  const p1 = share([w('aaaaaaaa-1', 3, 80)]);
  expect(await previewImport(p1)).toMatchObject({ existing: undefined, newCount: 1, total: 1 });
  await saveImportedShare(p1, NOW);
  const p2 = share([w('aaaaaaaa-1', 3, 80), w('bbbbbbbb-1', 1, 80), w('cccccccc-1', 2, 80)]);
  const pv = await previewImport(p2);
  expect(pv.existing?.id).toBe('friend000001');
  expect(pv).toMatchObject({ newCount: 2, total: 3, from: Math.floor((NOW - 3 * DAY) / 60000) * 60000, to: Math.floor((NOW - DAY) / 60000) * 60000 });
});

test('削除すると友達と記録が消え、自分の記録は変わらない', async () => {
  await saveWorkout(w('mine-uuid', 1, 100));
  await saveImportedShare(share([w('aaaaaaaa-1', 3, 80)]), NOW);
  await saveImportedShare(share([w('bbbbbbbb-1', 3, 80)], { id: 'friend000002' }), NOW);
  await deleteFriend('friend000001');
  expect(await getFriend('friend000001')).toBeUndefined();
  expect(await listFriendWorkouts('friend000001')).toEqual([]);
  expect(await listFriendWorkouts('friend000002')).toHaveLength(1);
  expect((await listWorkouts()).map((x) => x.id)).toEqual(['mine-uuid']);
});

test('saveProfileName は初回だけ12文字の ID を作り、2回目は名前だけ変える', async () => {
  expect(await getProfile()).toBeNull();
  const a = await saveProfileName('じろう');
  expect(a.id).toMatch(/^[A-Za-z0-9]{12}$/);
  const b = await saveProfileName('ジロー');
  expect(b).toEqual({ id: a.id, name: 'ジロー' });
  expect(await getProfile()).toEqual(b);
});

test('友達のテーブルは version 3 で用意されている', () => {
  expect(db.verno).toBe(3);
  expect(db.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['friends', 'friendWorkouts', 'feedbackIn', 'feedbackOut', 'menuLog']));
});

test('バックアップにプロフィールは入り友達は入らない。復元しても友達は消えず、プロフィールの無いバックアップなら今の ID を保つ', async () => {
  const me = await saveProfileName('じろう');
  await saveImportedShare(share([w('aaaaaaaa-1', 3, 80)]), NOW);
  const data = await exportAll(1);
  expect(data.profile).toEqual(me);
  expect(JSON.stringify(data)).not.toContain('friend000001');
  await importAll(data);
  expect(await getProfile()).toEqual(me);
  expect(await getFriend('friend000001')).toBeDefined();
  const { profile: _omit, ...noProfile } = data;
  await importAll(noProfile);
  expect(await getProfile()).toEqual(me);
  await importAll({ ...data, profile: { id: 'zzzzzzzzzzzz', name: '復元' } });
  expect(await getProfile()).toEqual({ id: 'zzzzzzzzzzzz', name: '復元' });
});

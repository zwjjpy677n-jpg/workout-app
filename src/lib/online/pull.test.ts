import { renderHook, waitFor } from '@testing-library/react';
import { db, resetDb } from '../../db/db';
import { listFriendWorkouts, listFriends } from '../../db/friends';
import type { MenuPayload } from '../share/menuPayload';
import { setApiForTest } from './api';
import { createFakeApi, type FakeApi } from './fakeApi';
import { getSession, setSession } from './prefs';
import { markFriendsSeen, pullAll, useUnread } from './pull';
import type { SharedWorkout } from './types';

let api: FakeApi;

const shared = (id: string, o: Partial<SharedWorkout> = {}): SharedWorkout => ({
  id, name: '胸の日', startedAt: 1_000_000, endedAt: 4_000_000,
  body: { e: [['bench000', 'ベンチプレス', 0, 0, [[60, 5, null, null]]]] }, ...o,
});

const menu = (name: string, o: Partial<MenuPayload> = {}): MenuPayload => ({
  id: 'a', n: 'あ', to: 'b', at: 1, mid: `mid${name.length}`, name, weekday: 1,
  items: [['ベンチプレス', 0, 0, 90, 3, '5', 1, 2.5, 'メモ']], ...o,
});

async function setup() {
  api = createFakeApi();
  setApiForTest(api);
  api.as('a');
  await api.saveMyName('あ');
  const code = await api.createInvite();
  api.as('b');
  await api.saveMyName('い');
  await api.acceptInvite(code);
  setSession({ userId: 'b' });
}

const asA = async (f: () => Promise<void>) => {
  api.as('a');
  await f();
  api.as('b');
};

beforeEach(async () => {
  localStorage.clear();
  await resetDb();
  await setup();
});
afterEach(() => {
  setApiForTest(null);
  localStorage.clear();
});

test('友達と記録が入る', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  expect(await pullAll(5000)).toBe('done');
  const fs = await listFriends();
  expect(fs).toHaveLength(1);
  expect(fs[0]).toMatchObject({ id: 'a', name: 'あ', online: { userId: 'a' }, receivedAt: 5000, count: 1 });
  expect(fs[0].exercises.map((e) => e.name)).toEqual(['ベンチプレス']);
  expect(fs[0].prs).toHaveLength(1);
  const ws = await listFriendWorkouts('a');
  expect(ws[0]).toMatchObject({ id: 'a:w1', endedAt: 4_000_000, receivedAt: 5000 });
});

test('差分だけ取る：二重にならず、直した記録は新しくなる', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await pullAll(5000);
  expect((await db.sync.get('workoutsSince'))?.value).not.toBe('');
  await pullAll(6000);
  expect(await db.friendWorkouts.count()).toBe(1);
  expect((await db.friendWorkouts.get('a:w1'))?.receivedAt).toBe(5000);
  await asA(() => api.upsertWorkout(shared('w1', { name: '直した', body: { e: [['bench000', 'ベンチプレス', 0, 0, [[70, 5, null, null]]]] } })));
  await pullAll(7000);
  expect(await db.friendWorkouts.count()).toBe(1);
  const w = await db.friendWorkouts.get('a:w1');
  expect(w?.name).toBe('直した');
  expect(w?.entries[0].sets[0].weight).toBe(70);
  expect((await db.friends.get('a'))?.prs[0].set.weight).toBe(70);
});

test('種目は今回の分だけでなく、これまでの記録の分も残る', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await pullAll(5000);
  await asA(() => api.upsertWorkout(shared('w2', { body: { e: [['squat000', 'スクワット', 1, 0, [[80, 5, null, null]]]] } })));
  await pullAll(6000);
  const f = (await db.friends.get('a'))!;
  expect(f.exercises.map((e) => e.name).sort()).toEqual(['スクワット', 'ベンチプレス']);
  expect(f.prs).toHaveLength(2);
});

test('消された記録は端末からも消える', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await pullAll(5000);
  await asA(() => api.deleteWorkout('w1'));
  await pullAll(6000);
  expect(await db.friendWorkouts.count()).toBe(0);
  expect((await db.friends.get('a'))?.prs).toEqual([]);
});

test('自分のメニュー（mine）は友達のメニュー一覧へ、同じ名前の古い版は履歴へ', async () => {
  await asA(() => api.sendMenu('b', 'mine', menu('胸')));
  await pullAll(5000);
  let f = (await db.friends.get('a'))!;
  expect(f.routines).toHaveLength(1);
  expect(f.routines[0]).toMatchObject({ id: 'a:menu:胸', name: '胸', weekday: 1, createdAt: 5000 });
  expect(f.routines[0].items[0]).toMatchObject({ sets: 3, reps: '5', main: true, inc: 2.5, note: 'メモ', exerciseId: 'a:n:ベンチプレス' });
  expect(f.exercises.some((e) => e.id === 'a:n:ベンチプレス')).toBe(true);
  await asA(() => api.sendMenu('b', 'mine', menu('胸', { weekday: -1, items: [['ベンチプレス', 0, 0, 90, 4, '5', 1, 2.5, '']] })));
  await pullAll(6000);
  f = (await db.friends.get('a'))!;
  expect(f.routines).toHaveLength(1);
  expect(f.routines[0].weekday).toBeNull();
  expect(f.menuHistory).toHaveLength(1);
});

test('メニューの種目は、同じ名前の友達の種目を使い回す', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await asA(() => api.sendMenu('b', 'mine', menu('胸')));
  await pullAll(5000);
  const f = (await db.friends.get('a'))!;
  expect(f.routines[0].items[0].exerciseId).toBe('a:bench000');
  expect(f.exercises).toHaveLength(1);
});

test('組んだメニュー（built）は届いたメニューに入る', async () => {
  await asA(() => api.sendMenu('b', 'built', menu('脚')));
  await pullAll(5000);
  const rows = await db.menuInbox.toArray();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ from: 'a', fromName: 'あ' });
  expect(rows[0].body.name).toBe('脚');
  await db.menuInbox.clear();
  await pullAll(6000);
  expect(await db.menuInbox.count()).toBe(0);
  // 同じ id は二重に入らない
  await db.sync.put({ key: 'menusSince', value: '' });
  await pullAll(7000);
  expect(await db.menuInbox.count()).toBe(1);
  await db.sync.put({ key: 'menusSince', value: '' });
  await pullAll(8000);
  expect(await db.menuInbox.count()).toBe(1);
});

test('未読：取ってきたあとは 1、markFriendsSeen のあとは 0', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await asA(() => api.sendMenu('b', 'built', menu('脚')));
  const { result } = renderHook(() => useUnread());
  await pullAll(5000);
  await waitFor(() => expect(result.current.total).toBe(2));
  expect([...result.current.friends]).toEqual(['a']);
  await markFriendsSeen(6000);
  await waitFor(() => expect(result.current.friends.size).toBe(0));
  expect(result.current.total).toBe(1);
  await db.menuInbox.clear();
  await waitFor(() => expect(result.current.total).toBe(0));
});

test('オフラインなら offline で何も変えない', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  api.offline = true;
  expect(await pullAll(5000)).toBe('offline');
  expect(await db.friends.count()).toBe(0);
  expect(await db.sync.count()).toBe(0);
});

test('ログインしていない・窓口が無いときは skipped', async () => {
  setSession(null);
  expect(await pullAll(5000)).toBe('skipped');
  setSession({ userId: 'b' });
  setApiForTest(null);
  expect(await pullAll(5000)).toBe('skipped');
  expect(getSession()).not.toBeNull();
});

test('壊れた記録の行は捨てて、ほかは受け取る', async () => {
  await asA(async () => {
    await api.upsertWorkout(shared('bad1', { body: { e: [['x', 'x', 99, 0, [[1, 1, null, null]]]] } }));
    await api.upsertWorkout(shared('bad2', { body: { e: [['x', 'あ'.repeat(41), 0, 0, []]] } }));
    await api.upsertWorkout(shared('bad3', { body: { e: [['x', 'x', 0, 0, [[1e9, 1, null, null]]]] } }));
    await api.upsertWorkout(shared('bad4', { startedAt: NaN }));
    await api.upsertWorkout(shared('bad5', { body: {} as never }));
    await api.upsertWorkout(shared('bad 6'));
    await api.upsertWorkout(shared('good'));
  });
  expect(await pullAll(5000)).toBe('done');
  expect((await db.friendWorkouts.toArray()).map((w) => w.id)).toEqual(['a:good']);
  // 捨てた行も読み終えたことにする
  const since = (await db.sync.get('workoutsSince'))!.value as string;
  expect(since).not.toBe('');
  await pullAll(6000);
  expect(await db.friendWorkouts.count()).toBe(1);
});

test('壊れたメニューは捨てて、ほかは受け取る', async () => {
  await asA(async () => {
    await api.sendMenu('b', 'mine', menu('壊れ', { items: [] }));
    await api.sendMenu('b', 'built', { ...menu('壊れ2'), weekday: 99 });
    await api.sendMenu('b', 'built', menu('良い'));
  });
  expect(await pullAll(5000)).toBe('done');
  expect((await db.menuInbox.toArray()).map((m) => m.body.name)).toEqual(['良い']);
  expect((await db.friends.get('a'))?.routines ?? []).toEqual([]);
});

test('listFriends から消えた友達も端末には残る', async () => {
  await asA(() => api.upsertWorkout(shared('w1')));
  await pullAll(5000);
  api.as('zzz');
  setSession({ userId: 'zzz' });
  await pullAll(6000);
  expect(await db.friends.get('a')).toBeDefined();
  expect(await db.friendWorkouts.count()).toBe(1);
});

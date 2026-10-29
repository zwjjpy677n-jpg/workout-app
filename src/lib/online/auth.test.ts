import { ex, entry, set, wk } from '../../test/factories';
import { db, resetDb } from '../../db/db';
import { finishWorkout, saveWorkout } from '../../db/repository';
import { setApiForTest } from './api';
import { signIn, signOutOnline, syncNow } from './auth';
import { createFakeApi, type FakeApi } from './fakeApi';
import { queueMenu } from './outbox';
import { getAutoShare } from './prefs';
import type { MenuPayload } from '../share/menuPayload';

let api: FakeApi;
const A = 'u-a@example.com';
const B = 'u-b@example.com';
const F = 'friend';

const body: MenuPayload = { id: 'x', n: 'あ', to: F, at: 1, mid: 'm', name: 'PUSH', weekday: 1, items: [] };

/** F と a、F と b を友達にする */
async function setup() {
  api = createFakeApi();
  setApiForTest(api);
  api.as(F);
  await api.saveMyName('友');
  for (const u of [A, B]) {
    api.as(F);
    const code = await api.createInvite();
    api.as(u);
    await api.saveMyName(u === A ? 'あ' : 'い');
    await api.acceptInvite(code);
  }
  api.as(F);
  await api.upsertWorkout({ id: 'fw', name: '脚', startedAt: 1, endedAt: 2, body: { e: [] } });
  await api.signOut();
}

beforeEach(async () => {
  localStorage.clear();
  await resetDb();
  await setup();
});
afterEach(() => {
  setApiForTest(null);
  localStorage.clear();
});

test('同じ端末で別の人がログインしたら、前の人の送り予定と同期の位置は消える（友達の記録は残る）', async () => {
  await signIn('a@example.com', '123456');
  expect(getAutoShare()).toBe(true);
  await syncNow();
  expect(await db.friends.get(F)).toBeDefined();
  // a のまま、送れないうちに送り予定がたまる
  api.offline = true;
  await db.exercises.put(ex('bench', { name: 'ベンチ' }));
  const w = wk(Date.now() - 3600_000, [entry('bench', [set({ weight: 60, reps: 5 })])], { endedAt: null });
  await saveWorkout(w);
  await finishWorkout(w.id);
  await queueMenu(F, 'built', body);
  expect(await db.outbox.count()).toBe(2);
  api.offline = false;
  await signOutOnline();

  await signIn('b@example.com', '123456');
  expect(await db.outbox.count()).toBe(0);
  expect(await db.sync.get('workoutsSince')).toBeUndefined();
  expect(await db.sync.get('menusSince')).toBeUndefined();
  expect(await db.sync.get('pulledFriends')).toBeUndefined();
  expect(await db.friends.get(F)).toBeDefined();
  expect(await db.friendWorkouts.count()).toBe(1);
  await syncNow();
  // b の名前で a の記録・メニューが送られていない
  api.as(F);
  expect((await api.pullWorkouts('')).filter((r) => r.userId === B)).toEqual([]);
  expect(await api.pullMenus('')).toEqual([]);
});

test('同じ人がログインし直しても、送り予定は残って送られる', async () => {
  await signIn('a@example.com', '123456');
  api.offline = true;
  await queueMenu(F, 'built', body);
  api.offline = false;
  await signOutOnline();
  await signIn('a@example.com', '123456');
  expect(await db.outbox.count()).toBe(1);
  await syncNow();
  api.as(F);
  expect((await api.pullMenus('')).map((m) => m.sender)).toEqual([A]);
});

test('前の人が送った記録の印も消える（b では新しい記録として扱う）', async () => {
  await signIn('a@example.com', '123456');
  await db.sync.put({ key: 'sent:w1', value: 1 });
  await signOutOnline();
  await signIn('b@example.com', '123456');
  expect(await db.sync.get('sent:w1')).toBeUndefined();
});

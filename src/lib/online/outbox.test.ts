import { ex, entry, set, wk } from '../../test/factories';
import { db, resetDb } from '../../db/db';
import { deleteWorkout, finishWorkout, saveWorkout, saveEditedWorkout } from '../../db/repository';
import { createFakeApi, type FakeApi } from './fakeApi';
import { setApiForTest } from './api';
import { flushOutbox, queueMenu, queueRecentWorkouts, queueWorkout } from './outbox';
import { getAutoShare, getSession, setAutoShare, setSession } from './prefs';
import type { MenuPayload } from '../share/menuPayload';

let api: FakeApi;
const DAY = 86_400_000;

async function setup() {
  api = createFakeApi();
  setApiForTest(api);
  api.as('a');
  await api.saveMyName('あ');
  const code = await api.createInvite();
  api.as('b');
  await api.saveMyName('い');
  await api.acceptInvite(code);
  api.as('a');
  setSession({ userId: 'a' });
}

const friendPull = async () => {
  api.as('b');
  const rows = await api.pullWorkouts('');
  api.as('a');
  return rows;
};

async function seedWorkout(o: { ended?: boolean; startedAt?: number } = {}) {
  await db.exercises.put(ex('bench', { name: 'ベンチ' }));
  const w = wk(o.startedAt ?? Date.now() - 3600_000, [entry('bench', [set({ weight: 60, reps: 5 })])], o.ended === false ? { endedAt: null } : {});
  await saveWorkout(w);
  return w;
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

test('終了すると送られる', async () => {
  const w = await seedWorkout({ ended: false });
  expect(await finishWorkout(w.id)).toBe('saved');
  await flushOutbox();
  const rows = await friendPull();
  expect(rows.map((r) => r.id)).toEqual([w.id]);
  expect(await db.outbox.count()).toBe(0);
});

test('オフラインなら残り、あとで送られる', async () => {
  const w = await seedWorkout({ ended: false });
  api.offline = true;
  await finishWorkout(w.id);
  expect(await flushOutbox()).toBe('offline');
  expect(await db.outbox.count()).toBe(1);
  api.offline = false;
  expect(await flushOutbox()).toBe('done');
  expect(await db.outbox.count()).toBe(0);
  expect(await friendPull()).toHaveLength(1);
});

test('直すと上書き、消すと削除が送られる', async () => {
  const w = await seedWorkout({ ended: false });
  api.offline = true;
  await finishWorkout(w.id);
  await saveEditedWorkout(w.id);
  expect(await db.outbox.count()).toBe(1);
  api.offline = false;
  await flushOutbox();
  expect(await friendPull()).toHaveLength(1);
  await deleteWorkout(w.id);
  await flushOutbox();
  const rows = await friendPull();
  expect(rows[0].deleted).toBe(true);
  expect(await db.outbox.count()).toBe(0);
});

test('自動共有オフ・未ログインなら入れない', async () => {
  const w = await seedWorkout();
  setAutoShare(false);
  await queueWorkout(w.id, 'upsert');
  expect(await db.outbox.count()).toBe(0);
  setAutoShare(true);
  setSession(null);
  await queueWorkout(w.id, 'upsert');
  expect(await db.outbox.count()).toBe(0);
  expect(getAutoShare()).toBe(true);
});

test('直近 8 週間をまとめて入れる', async () => {
  const now = Date.now();
  const a = await seedWorkout({ startedAt: now - 10 * DAY });
  await saveWorkout({ ...wk(now - 57 * DAY, [entry('bench', [set()])]) });
  await saveWorkout({ ...wk(now - DAY, [entry('bench', [set()])], { endedAt: null }) });
  expect(await queueRecentWorkouts(now)).toBe(1);
  expect((await db.outbox.toArray()).map((i) => i.id)).toEqual([`w:${a.id}`]);
});

test('ログインが切れたら止まり、記録は残る', async () => {
  const w = await seedWorkout();
  setApiForTest(createFakeApi()); // ログインしていないサーバー（auth エラーを返す）
  await queueWorkout(w.id, 'upsert');
  expect(await flushOutbox()).toBe('skipped');
  expect(await db.outbox.count()).toBe(1);
  expect(getSession()).toBeNull();
});

test('メニューも送られ、同時に flush しても二重送信しない', async () => {
  const body: MenuPayload = { id: 'x', n: 'あ', to: 'b', at: 1, mid: 'm', name: 'PUSH', weekday: 1, items: [] };
  await queueMenu('b', 'mine', body);
  const [r1, r2] = await Promise.all([flushOutbox(), flushOutbox()]);
  expect(r1).toBe('done');
  expect(r2).toBe('done');
  api.as('b');
  expect(await api.pullMenus('')).toHaveLength(1);
});

const shareOnce = async () => {
  const w = await seedWorkout({ ended: false });
  await finishWorkout(w.id);
  await flushOutbox();
  expect(await friendPull()).toHaveLength(1);
  return w;
};

test('自動共有をオフにしてから消しても、友達のほうでも消える', async () => {
  const w = await shareOnce();
  setAutoShare(false);
  await deleteWorkout(w.id);
  await flushOutbox();
  const rows = await friendPull();
  expect(rows[0].deleted).toBe(true);
  expect(await db.outbox.count()).toBe(0);
});

test('一度送った記録は、自動共有オフでも直した分が届く', async () => {
  const w = await shareOnce();
  setAutoShare(false);
  await db.workouts.update(w.id, { name: '直した' });
  await saveEditedWorkout(w.id);
  await flushOutbox();
  expect((await friendPull())[0].name).toBe('直した');
});

test('ログアウト中に消した分も残り、ログインしたら送られる', async () => {
  const w = await shareOnce();
  setSession(null);
  await deleteWorkout(w.id);
  expect(await db.outbox.count()).toBe(1);
  setSession({ userId: 'a' });
  await flushOutbox();
  expect((await friendPull())[0].deleted).toBe(true);
});

test('新しい記録は、自動共有オフなら送らない', async () => {
  setAutoShare(false);
  const w = await seedWorkout({ ended: false });
  await finishWorkout(w.id);
  await flushOutbox();
  expect(await db.outbox.count()).toBe(0);
  expect(await friendPull()).toHaveLength(0);
});

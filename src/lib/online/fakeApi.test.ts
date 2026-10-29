import { describe, expect, it } from 'vitest';
import { createFakeApi } from './fakeApi';
import { OnlineError, type SharedWorkout } from './types';
import type { MenuPayload } from '../share/menuPayload';

const DAY = 24 * 60 * 60 * 1000;
const w = (id: string): SharedWorkout => ({ id, name: 'push', startedAt: 1, endedAt: 2, body: { e: [] } });
const menu: MenuPayload = { id: 'm1', n: 'A', to: 'B', at: 1, mid: 'x', name: 'menu', weekday: 0, items: [] };

async function setup() {
  const api = createFakeApi();
  api.as('A');
  await api.saveMyName('エー');
  api.as('B');
  await api.saveMyName('ビー');
  return api;
}
async function befriend(api: Awaited<ReturnType<typeof setup>>, a = 'A', b = 'B') {
  api.as(a);
  const code = await api.createInvite();
  api.as(b);
  await api.acceptInvite(code);
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof OnlineError ? e.code : 'other'));

describe('fakeApi', () => {
  it('招待で友達になると、お互いの記録が見える', async () => {
    const api = await setup();
    api.as('C');
    await api.saveMyName('シー');
    await befriend(api);
    api.as('A');
    await api.upsertWorkout(w('w1'));
    api.as('B');
    expect((await api.pullWorkouts('')).map((r) => r.id)).toEqual(['w1']);
    expect(await api.listFriends()).toEqual([{ userId: 'A', name: 'エー' }]);
    api.as('C');
    expect(await api.pullWorkouts('')).toEqual([]);
    api.as('A');
    expect(await api.pullWorkouts('')).toEqual([]);
  });

  it('友達の招待は 1 回だけ', async () => {
    const api = await setup();
    api.as('C');
    await api.saveMyName('シー');
    api.as('A');
    const c = await api.createInvite();
    expect(c).toMatch(/^[A-Za-z0-9_-]{22}$/);
    api.as('B');
    await api.acceptInvite(c);
    api.as('C');
    expect(await code(api.acceptInvite(c))).toBe('used');
  });

  it('期限切れと自分の招待', async () => {
    const api = await setup();
    api.as('A');
    const c = await api.createInvite();
    expect(await code(api.acceptInvite(c))).toBe('self');
    expect(await code(api.acceptInvite('でたらめ'))).toBe('invalid');
    api.as('B');
    api.now += 8 * DAY;
    expect(await code(api.acceptInvite(c))).toBe('expired');
  });

  it('更新と削除は差分で届く', async () => {
    const api = await setup();
    await befriend(api);
    api.as('A');
    await api.upsertWorkout(w('w1'));
    api.as('B');
    const first = await api.pullWorkouts('');
    const since = first[0].updatedAt;
    expect(await api.pullWorkouts(since)).toEqual([]);
    api.as('A');
    await api.deleteWorkout('w1');
    api.as('B');
    const diff = await api.pullWorkouts(since);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ id: 'w1', deleted: true, userId: 'A' });
  });

  it('メニューは友達にだけ送れる', async () => {
    const api = await setup();
    api.as('A');
    expect(await code(api.sendMenu('B', 'built', menu))).toBe('invalid');
    await befriend(api);
    api.as('A');
    await api.sendMenu('B', 'built', menu);
    api.as('B');
    const got = await api.pullMenus('');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ sender: 'A', recipient: 'B', kind: 'built', body: menu });
    api.as('A');
    expect(await api.pullMenus('')).toEqual([]);
  });

  it('オフラインのときはすべて offline', async () => {
    const api = await setup();
    api.offline = true;
    const calls = [
      () => api.sendCode('a@b.c'), () => api.verifyCode('a@b.c', '123456'), () => api.currentUser(), () => api.signOut(),
      () => api.getMyName(), () => api.saveMyName('x'), () => api.createInvite(), () => api.acceptInvite('x'), () => api.listFriends(),
      () => api.upsertWorkout(w('w')), () => api.deleteWorkout('w'), () => api.pullWorkouts(''), () => api.sendMenu('B', 'mine', menu), () => api.pullMenus(''),
    ];
    for (const c of calls) expect(await code(c())).toBe('offline');
  });

  it('コードの間違い', async () => {
    const api = createFakeApi();
    expect(await api.currentUser()).toBeNull();
    expect(await code(api.verifyCode('a@b.c', '000000'))).toBe('code');
    const u = await api.verifyCode('a@b.c', '123456');
    expect(u.email).toBe('a@b.c');
    expect(await api.currentUser()).toEqual(u);
  });
});

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
  it('pullWorkouts は userId を渡すとその人の分だけ返す', async () => {
    const api = await setup();
    api.as('C');
    await api.saveMyName('シー');
    await befriend(api);
    await befriend(api, 'C', 'B');
    api.as('A');
    await api.upsertWorkout(w('wa'));
    api.as('C');
    await api.upsertWorkout(w('wc'));
    api.as('B');
    expect((await api.pullWorkouts('')).map((r) => r.id).sort()).toEqual(['wa', 'wc']);
    expect((await api.pullWorkouts('', 'C')).map((r) => r.id)).toEqual(['wc']);
    // つながっていない人を指定しても見えない
    api.as('A');
    expect(await api.pullWorkouts('', 'C')).toEqual([]);
  });

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

describe('fakeApi のグループ', () => {
  async function group() {
    const api = await setup();
    api.as('C');
    await api.saveMyName('シー');
    api.as('A');
    const g = await api.createGroup('朝練');
    const c = await api.createGroupInvite(g.id);
    api.as('B');
    expect(await api.acceptInvite(c)).toEqual({ userId: 'A', name: 'エー', kind: 'group' });
    // グループの招待は何人でも使える
    api.as('C');
    await api.acceptInvite(c);
    return { api, g };
  }

  it('メンバーどうしは記録が見え、リアクションとコメントを付けられる。友達にはならない', async () => {
    const { api, g } = await group();
    api.as('A');
    await api.upsertWorkout(w('wa'));
    expect(await api.listFriends()).toEqual([]);
    api.as('B');
    expect((await api.groupMembers(g.id)).map((m) => m.name)).toEqual(['エー', 'ビー', 'シー']);
    expect((await api.recentWorkouts(['A'], 0)).map((r) => r.id)).toEqual(['wa']);
    await api.setReaction({ owner: 'A', id: 'wa' }, '💪', true);
    await api.addComment({ owner: 'A', id: 'wa' }, 'ナイス');
    expect(await code(api.sendMenu('A', 'built', menu))).toBe('invalid');
    api.as('C');
    expect(await api.listReactions([{ owner: 'A', id: 'wa' }])).toEqual([{ owner: 'A', id: 'wa', userId: 'B', emoji: '💪' }]);
    expect((await api.listComments([{ owner: 'A', id: 'wa' }])).map((c) => c.body)).toEqual(['ナイス']);
  });

  it('抜けると見えなくなる。作った人が最後に抜けるとグループは消える', async () => {
    const { api, g } = await group();
    api.as('A');
    await api.upsertWorkout(w('wa'));
    api.as('C');
    await api.leaveGroup(g.id);
    expect(await api.listGroups()).toEqual([]);
    expect(await api.recentWorkouts(['A'], 0)).toEqual([]);
    expect(await code(api.setReaction({ owner: 'A', id: 'wa' }, '💪', true))).toBe('invalid');
    api.as('B');
    await api.leaveGroup(g.id);
    api.as('A');
    expect((await api.listGroups()).map((x) => x.name)).toEqual(['朝練']);
    await api.leaveGroup(g.id);
    expect(await api.listGroups()).toEqual([]);
  });

  it('名前を変えられるのは作った人だけ', async () => {
    const { api, g } = await group();
    api.as('B');
    await api.renameGroup(g.id, 'B案');
    api.as('A');
    await api.renameGroup(g.id, '夜練');
    api.as('C');
    expect((await api.listGroups())[0].name).toBe('夜練');
  });
});

// テスト専用。supabase/schema.sql の見え方（RLS）をまねる。アプリのコードからは import しない
import type { MenuPayload } from '../share/menuPayload';
import type { OnlineApi } from './api';
import { OnlineError, type FriendRow, type MenuMessage, type OnlineUser, type SharedWorkout, type SharedWorkoutRow } from './types';

export type FakeApi = OnlineApi & { as(userId: string, email?: string): void; offline: boolean; now: number };

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

type Invite = { owner: string; kind: 'friend'; expiresAt: number; usedBy: string | null };

export function createFakeApi(): FakeApi {
  let me: OnlineUser | null = null;
  let seq = 0;
  const names = new Map<string, string>();
  const invites = new Map<string, Invite>();
  const friends = new Set<string>(); // 'a|b'（辞書順）
  const blocks = new Set<string>(); // 'blocker|blocked'。phase 1 に API は無いが、見え方の規則だけ持つ
  const workouts = new Map<string, SharedWorkoutRow>(); // `${userId}|${id}`
  const menus: MenuMessage[] = [];

  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const connected = (a: string, b: string) => friends.has(pair(a, b)) && !blocks.has(`${a}|${b}`) && !blocks.has(`${b}|${a}`);

  const api: FakeApi = {
    offline: false,
    now: Date.now(),
    as(userId, email = `${userId}@example.com`) {
      me = { userId, email };
    },
  } as FakeApi;

  // 書き込みごとに 1ms ずつ進め、now が止まっていても updatedAt が必ず増えるようにする
  const stamp = () => new Date(api.now + ++seq).toISOString();
  const guard = (): void => {
    if (api.offline) throw new OnlineError('offline');
  };
  const user = (): OnlineUser => {
    guard();
    if (!me) throw new OnlineError('auth');
    return me;
  };
  const friendRow = (id: string): FriendRow => ({ userId: id, name: names.get(id) ?? '' });
  const newCode = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 22);

  Object.assign(api, {
    async sendCode() {
      guard();
    },
    async verifyCode(email: string, code: string) {
      guard();
      if (code !== '123456') throw new OnlineError('code');
      me = { userId: `u-${email}`, email };
      return me;
    },
    async currentUser() {
      guard();
      return me;
    },
    async signOut() {
      guard();
      me = null;
    },
    async getMyName() {
      return names.get(user().userId) ?? null;
    },
    async saveMyName(name: string) {
      names.set(user().userId, name);
    },
    async createInvite() {
      const u = user();
      const code = newCode();
      invites.set(code, { owner: u.userId, kind: 'friend', expiresAt: api.now + INVITE_MS, usedBy: null });
      return code;
    },
    async acceptInvite(code: string) {
      const u = user();
      const inv = invites.get(code);
      if (!inv || !names.has(u.userId)) throw new OnlineError('invalid');
      if (inv.usedBy) throw new OnlineError('used');
      if (inv.expiresAt < api.now) throw new OnlineError('expired');
      if (inv.owner === u.userId) throw new OnlineError('self');
      inv.usedBy = u.userId;
      friends.add(pair(inv.owner, u.userId));
      return friendRow(inv.owner);
    },
    async listFriends() {
      const u = user();
      const others = new Set([...friends].flatMap((p) => p.split('|')).filter((id) => id !== u.userId));
      return [...others].filter((id) => connected(u.userId, id)).map(friendRow);
    },
    async upsertWorkout(w: SharedWorkout) {
      const u = user();
      workouts.set(`${u.userId}|${w.id}`, { ...w, userId: u.userId, updatedAt: stamp(), deleted: false });
    },
    async deleteWorkout(id: string) {
      const u = user();
      const cur = workouts.get(`${u.userId}|${id}`);
      if (cur) workouts.set(`${u.userId}|${id}`, { ...cur, deleted: true, updatedAt: stamp() });
    },
    async pullWorkouts(since: string, userId?: string) {
      const u = user();
      return [...workouts.values()].filter(
        (r) => r.userId !== u.userId && connected(u.userId, r.userId) && r.updatedAt > since && (userId === undefined || r.userId === userId),
      );
    },
    async sendMenu(to: string, kind: 'built' | 'mine', body: MenuPayload) {
      const u = user();
      if (!connected(u.userId, to)) throw new OnlineError('invalid');
      menus.push({ id: `m${menus.length + 1}`, sender: u.userId, recipient: to, kind, body, createdAt: stamp() });
    },
    async pullMenus(since: string) {
      const u = user();
      return menus.filter((m) => m.recipient === u.userId && m.createdAt > since);
    },
  } satisfies OnlineApi);

  return api;
}

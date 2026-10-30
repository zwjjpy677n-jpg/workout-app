// テスト専用。supabase/schema.sql の見え方（RLS）をまねる。アプリのコードからは import しない
import type { MenuPayload } from '../share/menuPayload';
import type { OnlineApi } from './api';
import { OnlineError, type Comment, type Emoji, type FriendRow, type GroupRow, type MenuMessage, type OnlineUser, type Reaction, type SharedWorkout, type SharedWorkoutRow, type WorkoutKey } from './types';

export type FakeApi = OnlineApi & { as(userId: string, email?: string): void; block(blocker: string, blocked: string): void; offline: boolean; now: number };

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

type Invite = { owner: string; kind: 'friend' | 'group'; groupId?: string; expiresAt: number; usedBy: string | null };

export function createFakeApi(): FakeApi {
  let me: OnlineUser | null = null;
  let seq = 0;
  const names = new Map<string, string>();
  const invites = new Map<string, Invite>();
  const friends = new Set<string>(); // 'a|b'（辞書順）
  const blocks = new Set<string>(); // 'blocker|blocked'。phase 1 に API は無いが、見え方の規則だけ持つ
  const workouts = new Map<string, SharedWorkoutRow>(); // `${userId}|${id}`
  const menus: MenuMessage[] = [];
  const groups = new Map<string, GroupRow>();
  const members = new Map<string, string[]>(); // groupId → 入った順の userId
  let reactions: Reaction[] = [];
  const comments: (Comment & { deleted: boolean })[] = [];

  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const sameGroup = (a: string, b: string) => [...members.values()].some((m) => m.includes(a) && m.includes(b));
  const blocked = (a: string, b: string) => blocks.has(`${a}|${b}`) || blocks.has(`${b}|${a}`);
  const connected = (a: string, b: string) => (friends.has(pair(a, b)) || sameGroup(a, b)) && !blocked(a, b);
  const isFriend = (a: string, b: string) => friends.has(pair(a, b)) && !blocked(a, b);
  const canSee = (me: string, owner: string) => me === owner || connected(me, owner);
  const has = (keys: WorkoutKey[]) => (r: WorkoutKey) => keys.some((k) => k.owner === r.owner && k.id === r.id);
  const member = (gid: string, uid: string) => members.get(gid)?.includes(uid) ?? false;

  const api: FakeApi = {
    offline: false,
    now: Date.now(),
    as(userId, email = `${userId}@example.com`) {
      me = { userId, email };
    },
    block(blocker, blockedId) {
      blocks.add(`${blocker}|${blockedId}`);
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
    async signInAnonymously() {
      guard();
      me = { userId: `anon-${++seq}`, email: '', anonymous: true };
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
      if (inv.usedBy && inv.kind === 'friend') throw new OnlineError('used');
      if (inv.expiresAt < api.now) throw new OnlineError('expired');
      if (inv.owner === u.userId) throw new OnlineError('self');
      if (inv.kind === 'group') {
        const m = members.get(inv.groupId!);
        if (!m) throw new OnlineError('invalid');
        if (!m.includes(u.userId)) m.push(u.userId);
        return { ...friendRow(inv.owner), kind: 'group' as const };
      }
      inv.usedBy = u.userId;
      friends.add(pair(inv.owner, u.userId));
      return { ...friendRow(inv.owner), kind: 'friend' as const };
    },
    async listFriends() {
      const u = user();
      const others = new Set([...friends].flatMap((p) => p.split('|')).filter((id) => id !== u.userId));
      return [...others].filter((id) => isFriend(u.userId, id)).map(friendRow);
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
      if (!isFriend(u.userId, to)) throw new OnlineError('invalid');
      menus.push({ id: `m${menus.length + 1}`, sender: u.userId, recipient: to, kind, body, createdAt: stamp() });
    },
    async pullMenus(since: string) {
      const u = user();
      return menus.filter((m) => m.recipient === u.userId && m.createdAt > since);
    },
    async unsendMenu(mid: string) {
      const u = user();
      for (let i = menus.length - 1; i >= 0; i--) if (menus[i].sender === u.userId && menus[i].body.mid === mid) menus.splice(i, 1);
    },
    async existingMenus(ids: string[]) {
      const u = user();
      return menus.filter((m) => m.recipient === u.userId && ids.includes(m.id)).map((m) => m.id);
    },
    async createGroup(name: string) {
      const u = user();
      const g = { id: `g${groups.size + 1}`, name, owner: u.userId };
      groups.set(g.id, g);
      members.set(g.id, [u.userId]);
      return { ...g };
    },
    async listGroups() {
      const u = user();
      return [...groups.values()].filter((g) => member(g.id, u.userId)).map((g) => ({ ...g }));
    },
    async renameGroup(id: string, name: string) {
      const u = user();
      const g = groups.get(id);
      if (g?.owner === u.userId) g.name = name;
    },
    async leaveGroup(id: string) {
      const u = user();
      const m = (members.get(id) ?? []).filter((x) => x !== u.userId);
      if (groups.get(id)?.owner === u.userId && !m.length) {
        groups.delete(id);
        members.delete(id);
      } else if (members.has(id)) members.set(id, m);
    },
    async createGroupInvite(groupId: string) {
      const u = user();
      if (!member(groupId, u.userId)) throw new OnlineError('invalid');
      const code = newCode();
      invites.set(code, { owner: u.userId, kind: 'group', groupId, expiresAt: api.now + INVITE_MS, usedBy: null });
      return code;
    },
    async groupMembers(groupId: string) {
      const u = user();
      if (!member(groupId, u.userId)) return [];
      return (members.get(groupId) ?? []).filter((id) => canSee(u.userId, id)).map(friendRow);
    },
    async recentWorkouts(userIds: string[], since: number) {
      const u = user();
      return [...workouts.values()]
        .filter((r) => userIds.includes(r.userId) && canSee(u.userId, r.userId) && !r.deleted && r.endedAt >= since)
        .sort((a, b) => b.endedAt - a.endedAt);
    },
    async listReactions(keys: WorkoutKey[]) {
      const u = user();
      return reactions.filter(has(keys)).filter((r) => canSee(u.userId, r.owner)).map((r) => ({ ...r }));
    },
    async setReaction(key: WorkoutKey, emoji: Emoji, on: boolean) {
      const u = user();
      if (!canSee(u.userId, key.owner) || !workouts.has(`${key.owner}|${key.id}`)) throw new OnlineError('invalid');
      const same = (r: Reaction) => r.owner === key.owner && r.id === key.id && r.userId === u.userId && r.emoji === emoji;
      reactions = reactions.filter((r) => !same(r));
      if (on) reactions.push({ ...key, userId: u.userId, emoji });
    },
    async listComments(keys: WorkoutKey[]) {
      const u = user();
      return comments
        .filter((c) => !c.deleted && has(keys)(c) && canSee(u.userId, c.owner))
        .map(({ deleted: _, ...c }): Comment => c);
    },
    async addComment(key: WorkoutKey, body: string) {
      const u = user();
      if (!canSee(u.userId, key.owner) || !workouts.has(`${key.owner}|${key.id}`)) throw new OnlineError('invalid');
      comments.push({ ...key, commentId: `c${comments.length + 1}`, userId: u.userId, body, createdAt: stamp(), deleted: false });
    },
    async deleteComment(commentId: string) {
      const u = user();
      const c = comments.find((x) => x.commentId === commentId && x.userId === u.userId);
      if (c) c.deleted = true;
    },
  } satisfies OnlineApi);

  return api;
}

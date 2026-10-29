import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { mergeMenus } from '../../db/friends';
import { BODY_PARTS, type Exercise, type Routine } from '../types';
import { setTuple, type Friend } from '../share/importShare';
import { parseMenuPayload, type MenuPayload } from '../share/menuPayload';
import { LIMIT, TYPES, type SetTuple } from '../share/sharePayload';
import { arr, id, int, isNum, str, tup } from '../share/validate';
import { getApi } from './api';
import { getSession } from './prefs';
import { friendPrs, fromSharedRows } from './sharedWorkout';
import { OnlineError, type MenuMessage, type SharedWorkoutRow } from './types';

/** 友達から届いた「組んだメニュー」。取り込むかは本人が決める */
export interface MenuInboxItem {
  id: string;
  from: string;
  fromName: string;
  body: MenuPayload;
  at: number;
}

const UNKNOWN_NAME = '友達';

/** サーバーの行は友達が自由に書ける。形と範囲を全部確かめ、外れたら null（作り直した行を返す） */
function cleanRow(r: unknown): SharedWorkoutRow | null {
  try {
    if (typeof r !== 'object' || r === null) return null;
    const o = r as Record<string, unknown>;
    if (typeof o.userId !== 'string' || typeof o.updatedAt !== 'string' || typeof o.deleted !== 'boolean') return null;
    const base = { userId: o.userId, updatedAt: o.updatedAt, deleted: o.deleted, id: id(o.id) };
    if (o.deleted) return { ...base, name: '', startedAt: 0, endedAt: 0, body: { e: [] } };
    if (!isNum(o.startedAt) || !isNum(o.endedAt)) return null;
    const body = o.body as { e?: unknown } | null;
    if (typeof body !== 'object' || body === null) return null;
    const e = arr(body.e, LIMIT.entries).map((en): SharedWorkoutRow['body']['e'][number] => {
      const [x8, name, part, type, sets] = tup(en, 5);
      return [
        id(x8), str(name, 1, LIMIT.name), int(part, 0, BODY_PARTS.length - 1), int(type, 0, TYPES.length - 1),
        arr(sets, LIMIT.sets).map((s): SetTuple => setTuple(s)),
      ];
    });
    return { ...base, name: str(o.name, 0, LIMIT.name), startedAt: o.startedAt, endedAt: o.endedAt, body: { e } };
  } catch {
    return null;
  }
}

function cleanMenu(m: MenuMessage): MenuMessage | null {
  try {
    if ((m.kind !== 'built' && m.kind !== 'mine') || typeof m.id !== 'string' || typeof m.sender !== 'string' || typeof m.createdAt !== 'string') return null;
    return { ...m, body: parseMenuPayload(m.body) };
  } catch {
    return null;
  }
}

const maxOf = (xs: string[], init: string) => xs.reduce((a, b) => (b > a ? b : a), init);

/** 'mine' のメニューを友達のルーティンにする。種目は同じ名前の友達の種目を使い回し、無ければ作る */
function toRoutine(friend: Friend, p: MenuPayload, now: number): Routine {
  const byName = new Map(friend.exercises.map((e) => [e.name, e]));
  const items = p.items.map(([name, part, type, restSec, sets, reps, main, inc, note]) => {
    let ex = byName.get(name);
    if (!ex) {
      ex = { id: `${friend.id}:n:${name}`, name, bodyPart: BODY_PARTS[part], type: TYPES[type], restSec, archived: false, createdAt: 0, barKg: null } satisfies Exercise;
      friend.exercises.push(ex);
      byName.set(name, ex);
    }
    return { exerciseId: ex.id, sets, reps, main: main === 1, inc, note };
  });
  return { id: `${friend.id}:menu:${p.name}`, name: p.name, weekday: p.weekday < 0 ? null : p.weekday, createdAt: now, items };
}

/** 友達・記録・メニューをサーバーから取ってくる。通信が先、書き込みは最後にまとめて（失敗しても中途半端に残さない） */
export async function pullAll(now: number): Promise<'done' | 'offline' | 'skipped'> {
  const api = getApi();
  if (!api || !getSession()) return 'skipped';
  const cursor = async (key: string) => String((await db.sync.get(key))?.value ?? '');
  const wSince = await cursor('workoutsSince');
  const mSince = await cursor('menusSince');

  let list, rawRows, rawMenus;
  try {
    list = await api.listFriends();
    rawRows = await api.pullWorkouts(wSince);
    rawMenus = await api.pullMenus(mSince);
  } catch (e) {
    if (e instanceof OnlineError && e.code === 'offline') return 'offline';
    throw e;
  }

  const nextW = maxOf(rawRows.map((r) => r.updatedAt).filter((s) => typeof s === 'string'), wSince);
  const nextM = maxOf(rawMenus.map((m) => m.createdAt).filter((s) => typeof s === 'string'), mSince);
  const rows = rawRows.map(cleanRow).filter((r): r is SharedWorkoutRow => r !== null);
  const menus = rawMenus.map(cleanMenu).filter((m): m is MenuMessage => m !== null);
  const names = new Map(list.map((f) => [f.userId, f.name]));

  await db.transaction('rw', db.friends, db.friendWorkouts, db.menuInbox, db.sync, async () => {
    const touched = new Set<string>([...names.keys(), ...rows.map((r) => r.userId), ...menus.filter((m) => m.kind === 'mine').map((m) => m.sender)]);
    for (const uid of touched) {
      const old = await db.friends.get(uid);
      const mine = rows.filter((r) => r.userId === uid);
      const { workouts, exercises } = fromSharedRows(uid, mine);
      await db.friendWorkouts.bulkDelete(mine.filter((r) => r.deleted).map((r) => `${uid}:${r.id}`));
      await db.friendWorkouts.bulkPut(workouts.map((w) => ({ ...w, receivedAt: now })));
      const all = await db.friendWorkouts.where('friendId').equals(uid).toArray();
      const known = new Map((old?.exercises ?? []).map((e) => [e.id, e]));
      for (const e of exercises) known.set(e.id, e);
      let friend: Friend = {
        id: uid, name: names.get(uid) ?? old?.name ?? UNKNOWN_NAME, online: { userId: uid },
        receivedAt: old && !mine.length ? old.receivedAt : now, sharedAt: now,
        exercises: [...known.values()], routines: old?.routines ?? [], menuHistory: old?.menuHistory, prs: [],
      };
      for (const m of menus.filter((m) => m.kind === 'mine' && m.sender === uid)) {
        friend = { ...friend, ...mergeMenus(friend, [toRoutine(friend, m.body, now)]) };
      }
      friend.prs = friendPrs(friend.exercises, all);
      await db.friends.put(friend);
    }
    for (const m of menus.filter((m) => m.kind === 'built')) {
      if (await db.menuInbox.get(m.id)) continue;
      const at = Date.parse(m.createdAt);
      await db.menuInbox.put({ id: m.id, from: m.sender, fromName: names.get(m.sender) ?? (await db.friends.get(m.sender))?.name ?? UNKNOWN_NAME, body: m.body, at: Number.isFinite(at) ? at : now });
    }
    await db.sync.bulkPut([
      { key: 'workoutsSince', value: nextW },
      { key: 'menusSince', value: nextM },
    ]);
  });
  return 'done';
}

export async function markFriendsSeen(now: number): Promise<void> {
  await db.sync.put({ key: 'seenAt', value: now });
}

/** 未読の友達（見ていない新しい記録がある）と、未処理の届いたメニューの件数 */
export function useUnread(): { friends: Set<string>; total: number } {
  const r = useLiveQuery(async () => {
    const seen = Number((await db.sync.get('seenAt'))?.value ?? 0);
    const ws = await db.friendWorkouts.filter((w) => (w.receivedAt ?? 0) > seen).toArray();
    return { friends: [...new Set(ws.map((w) => w.friendId))], menus: await db.menuInbox.count() };
  });
  const friends = new Set(r?.friends ?? []);
  return { friends, total: friends.size + (r?.menus ?? 0) };
}

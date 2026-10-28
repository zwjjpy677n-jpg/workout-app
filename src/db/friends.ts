import { toFriendRecords, type Friend, type FriendWorkout } from '../lib/share/importShare';
import type { SharePayload } from '../lib/share/sharePayload';
import { db } from './db';

export type Profile = { id: string; name: string };

export async function getProfile(): Promise<Profile | null> {
  const row = await db.settings.get('profile');
  return row?.key === 'profile' ? { id: row.id, name: row.name } : null;
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALNUM[b % ALNUM.length]).join('');

/** 名前を保存する。ID が無ければこのとき作る（以後変えない） */
export async function saveProfileName(name: string): Promise<Profile> {
  return db.transaction('rw', db.settings, async () => {
    const p = { id: (await getProfile())?.id ?? newId(), name };
    await db.settings.put({ key: 'profile', ...p });
    return p;
  });
}

export async function listFriends(): Promise<(Friend & { lastAt: number | null; count: number })[]> {
  const friends = await db.friends.toArray();
  const rows = await Promise.all(
    friends.map(async (f) => {
      const ws = await db.friendWorkouts.where('friendId').equals(f.id).toArray();
      return { ...f, lastAt: ws.length ? Math.max(...ws.map((w) => w.startedAt)) : null, count: ws.length };
    }),
  );
  return rows.sort((a, b) => b.receivedAt - a.receivedAt);
}

export const getFriend = (id: string) => db.friends.get(id);

export async function listFriendWorkouts(friendId: string): Promise<FriendWorkout[]> {
  return (await db.friendWorkouts.where('friendId').equals(friendId).toArray()).sort((a, b) => b.startedAt - a.startedAt);
}

export async function previewImport(p: SharePayload) {
  const { workouts } = toFriendRecords(p, 0);
  const existing = await db.friends.get(p.id);
  const have = new Set((await db.friendWorkouts.bulkGet(workouts.map((w) => w.id))).filter(Boolean).map((w) => w!.id));
  const starts = workouts.map((w) => w.startedAt);
  return {
    existing,
    newCount: workouts.filter((w) => !have.has(w.id)).length,
    total: workouts.length,
    from: starts.length ? Math.min(...starts) : null,
    to: starts.length ? Math.max(...starts) : null,
  };
}

/** 記録は貯める（同じ記録は最新で上書き、届かなかった古い記録は残す）。名前・種目・メニュー・自己ベストは新しいリンクのときだけ置き換える */
export async function saveImportedShare(p: SharePayload, now: number): Promise<void> {
  const { friend, workouts } = toFriendRecords(p, now);
  await db.transaction('rw', db.friends, db.friendWorkouts, async () => {
    const old = await db.friends.get(friend.id);
    await db.friends.put(old && old.sharedAt > friend.sharedAt ? { ...old, receivedAt: now } : friend);
    await db.friendWorkouts.bulkPut(workouts);
  });
}

export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.friendWorkouts, async () => {
    await db.friendWorkouts.where('friendId').equals(id).delete();
    await db.friends.delete(id);
  });
}

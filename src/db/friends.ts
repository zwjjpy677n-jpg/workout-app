import { toFriendRecords, type Friend, type FriendWorkout } from '../lib/share/importShare';
import type { SharePayload } from '../lib/share/sharePayload';
import { randomId } from '../lib/share/ids';
import { db } from './db';

export type Profile = { id: string; name: string };

export async function getProfile(): Promise<Profile | null> {
  const row = await db.settings.get('profile');
  return row?.key === 'profile' ? { id: row.id, name: row.name } : null;
}


/** 名前を保存する。ID が無ければこのとき作る（以後変えない） */
export async function saveProfileName(name: string): Promise<Profile> {
  return db.transaction('rw', db.settings, async () => {
    const p = { id: (await getProfile())?.id ?? randomId(), name };
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
    if (old && old.sharedAt > friend.sharedAt) {
      // 古いリンク: まだ無い記録・種目・自己ベストだけ足す（保存済みは新しい方のまま）
      await db.friends.put({ ...old, receivedAt: now, exercises: mergeById(friend.exercises, old.exercises, (e) => e.id), prs: mergeById(friend.prs, old.prs, (p) => p.exerciseId) });
      const have = new Set((await db.friendWorkouts.bulkGet(workouts.map((w) => w.id))).filter(Boolean).map((w) => w!.id));
      await db.friendWorkouts.bulkAdd(workouts.filter((w) => !have.has(w.id)));
    } else {
      // 新しいリンクに載っていない種目も、前に受け取った記録が使うので残す
      await db.friends.put(old ? { ...friend, exercises: mergeById(old.exercises, friend.exercises, (e) => e.id), prs: mergeById(old.prs, friend.prs, (p) => p.exerciseId) } : friend);
      await db.friendWorkouts.bulkPut(workouts);
    }
  });
}

/** base に over を重ねる（同じキーは over が勝つ） */
function mergeById<T>(base: T[], over: T[], key: (x: T) => string): T[] {
  const m = new Map(base.map((x) => [key(x), x]));
  for (const x of over) m.set(key(x), x);
  return [...m.values()];
}

export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.friendWorkouts, async () => {
    await db.friendWorkouts.where('friendId').equals(id).delete();
    await db.friends.delete(id);
  });
}

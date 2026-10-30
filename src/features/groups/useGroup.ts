import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../../lib/online/api';
import { setSession } from '../../lib/online/prefs';
import { fromSharedRows } from '../../lib/online/sharedWorkout';
import { OnlineError, type Comment, type FriendRow, type GroupRow, type Reaction, type WorkoutKey } from '../../lib/online/types';
import type { FriendWorkout } from '../../lib/share/importShare';
import type { Exercise } from '../../lib/types';

/** グループの画面に出す記録は直近30日 */
export const FEED_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type FeedItem = { key: WorkoutKey; who: string; workout: FriendWorkout };
export type GroupData = {
  group: GroupRow;
  members: FriendRow[];
  feed: FeedItem[];
  exercises: Map<string, Exercise>;
  reactions: Reaction[];
  comments: Comment[];
  /** メンバーでなくなった人のコメントにも名前を出すため */
  names: Map<string, string>;
};
export type GroupState = GroupData | 'loading' | 'gone' | 'offline' | 'auth';

async function load(id: string, now: number): Promise<GroupData | 'gone'> {
  const api = getApi()!;
  const group = (await api.listGroups()).find((g) => g.id === id);
  if (!group) return 'gone';
  const members = await api.groupMembers(id);
  const names = new Map(members.map((m) => [m.userId, m.name]));
  const rows = await api.recentWorkouts(members.map((m) => m.userId), now - FEED_DAYS * DAY);
  const exercises = new Map<string, Exercise>();
  const feed: FeedItem[] = [];
  for (const m of members) {
    const mine = rows.filter((r) => r.userId === m.userId);
    const { workouts, exercises: ex } = fromSharedRows(m.userId, mine);
    for (const e of ex) exercises.set(e.id, e);
    workouts.forEach((w) => feed.push({ key: { owner: m.userId, id: w.id.slice(m.userId.length + 1) }, who: m.name, workout: w }));
  }
  feed.sort((a, b) => (b.workout.endedAt ?? 0) - (a.workout.endedAt ?? 0));
  const keys = feed.map((f) => f.key);
  const [reactions, comments] = await Promise.all([api.listReactions(keys), api.listComments(keys)]);
  return { group, members, feed, exercises, reactions, comments, names };
}

/** グループの中身をサーバーから取る（端末には残さない）。reload で取り直す。取り直している間は前の中身を出したまま */
export function useGroup(id: string): { state: GroupState; reload(): Promise<void> } {
  const [state, setState] = useState<GroupState>('loading');
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await load(id, Date.now());
      if (n === seq.current) setState(r);
    } catch (e) {
      if (n !== seq.current) return;
      if (e instanceof OnlineError && e.code === 'auth') {
        setSession(null);
        return setState('auth');
      }
      setState((cur) => (typeof cur === 'object' ? cur : 'offline'));
      throw e;
    }
  }, [id]);
  useEffect(() => {
    setState('loading');
    reload().catch(() => {
      /* 状態に出している */
    });
  }, [reload]);
  return { state, reload };
}

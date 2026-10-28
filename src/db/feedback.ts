import type { FeedbackIn, FeedbackOut, FeedbackPayload } from '../lib/share/feedbackPayload';
import { randomId } from '../lib/share/ids';
import { db } from './db';
import { getProfile } from './friends';
import { stamp } from './stamp';

// --- 書いたコメント（友達の記録へ） ---
export async function saveDraft(d: Omit<FeedbackOut, 'id' | 'at' | 'sentAt'> & { id?: string }): Promise<FeedbackOut> {
  const old = d.id ? await db.feedbackOut.get(d.id) : undefined;
  const row: FeedbackOut = { ...d, id: d.id ?? randomId(), at: old?.at ?? stamp(), sentAt: old?.sentAt ?? null };
  await db.feedbackOut.put(row);
  return row;
}

export const deleteDraft = (id: string) => db.feedbackOut.delete(id);

export async function listFeedbackOut(friendId: string): Promise<FeedbackOut[]> {
  return (await db.feedbackOut.toArray()).filter((f) => f.friendId === friendId).sort((a, b) => a.at - b.at);
}

export async function markSent(ids: string[], at: number): Promise<void> {
  await db.feedbackOut.where('id').anyOf(ids).modify({ sentAt: at });
}

// --- 届いたコメント（自分の記録へ） ---
export async function previewFeedback(p: FeedbackPayload) {
  const mine = (await getProfile())?.id === p.to;
  const have = await db.feedbackIn.bulkGet(p.c.map((c) => c[0]));
  return { mine, count: p.c.length, newCount: have.filter((x) => !x).length };
}

/** 短い ID は自分の記録・種目の ID の先頭8文字なので、前方一致で探す。見つからなければ null で保存する */
export async function importFeedback(p: FeedbackPayload): Promise<number> {
  if ((await getProfile())?.id !== p.to) return 0;
  return db.transaction('rw', db.feedbackIn, db.workouts, db.exercises, async () => {
    const find = async (table: typeof db.workouts | typeof db.exercises, short: string | null) =>
      short ? ((await table.where('id').startsWith(short).first())?.id ?? null) : null;
    const rows: FeedbackIn[] = [];
    for (const [fid, w8, week, x8, text, at] of p.c) {
      const old = await db.feedbackIn.get(fid);
      rows.push({
        id: fid, friendId: p.id, friendName: p.n, workoutId: await find(db.workouts, w8), week,
        exerciseId: await find(db.exercises, x8), text, at: at * 60000, read: old?.read ?? false,
      });
    }
    await db.feedbackIn.bulkPut(rows);
    return rows.length;
  });
}

export async function listInbox(): Promise<FeedbackIn[]> {
  return (await db.feedbackIn.toArray()).sort((a, b) => b.at - a.at);
}

export const markRead = (id: string) => db.feedbackIn.update(id, { read: true });

export async function feedbackForWorkouts(ids: string[]): Promise<FeedbackIn[]> {
  return (await db.feedbackIn.where('workoutId').anyOf(ids).toArray()).sort((a, b) => a.at - b.at);
}

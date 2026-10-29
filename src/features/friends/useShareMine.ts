import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getProfile } from '../../db/friends';
import { listExercises, listRoutines, listWorkouts } from '../../db/repository';
import { ShareError } from '../../lib/share/codec';
import { buildShareLink } from '../../lib/share/sharePayload';
import { copyText, shareSheet } from '../../lib/device';
import { usePreparedLink } from './usePreparedLink';

export type ShareNote = { kind: 'status' | 'alert'; text: string } | null;
type Link = Awaited<ReturnType<typeof buildShareLink>>;

const ERRORS: Record<string, string> = {
  'too-large': '記録が多すぎて共有できません',
  unsupported: 'この端末では共有を使えません',
};

/**
 * 自分の記録のリンクを前もって作っておき、タップしたらすぐ共有画面を出す。
 * iPhone の Safari はタップの直後でないと共有画面を出せないので、押してから作るのでは間に合わない
 */
export function useShareMine() {
  const src = useLiveQuery(async () => {
    const profile = await getProfile();
    if (!profile) return null;
    return { profile, exercises: await listExercises({ includeArchived: true }), routines: await listRoutines(), workouts: await listWorkouts() };
  });
  const link = usePreparedLink<Link>(src ? () => buildShareLink(src, Date.now()) : null, [src]);
  const [note, setNote] = useState<ShareNote>(null);

  const shareMine = () => {
    setNote(null);
    if (!link) return;
    if (link instanceof ShareError) return setNote({ kind: 'alert', text: ERRORS[link.code] ?? '共有できませんでした' });
    void sendText(link.text, setNote);
  };
  return {
    loading: src === undefined,
    ready: link !== null,
    hasProfile: !!src,
    /** 削って収めたときは、押す前に見せておく（押してから確認を出すと iPhone で共有画面が出なくなる） */
    trimmedWeeks: link && !(link instanceof ShareError) && link.trimmed ? link.weeks : null,
    shareMine,
    note,
  };
}

let sending = false;

/**
 * 共有画面で送る（無ければコピー）。タップの onClick の中で await より前に呼ぶこと。
 * 共有画面が開いている間の2回目のタップは何もしない（送っていないのに送信済みにしないため）
 */
export async function sendText(text: string, setNote: (n: ShareNote) => void): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (sending) return 'cancelled';
  sending = true;
  try {
    return await send(text, setNote);
  } finally {
    sending = false;
  }
}

async function send(text: string, setNote: (n: ShareNote) => void): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  try {
    const r = await shareSheet({ text });
    if (r !== 'unavailable') return r;
  } catch {
    // 共有できなかったときはコピーに切り替える
  }
  try {
    await copyText(text);
    setNote({ kind: 'status', text: 'コピーしました。LINE に貼り付けて送ってください' });
    return 'copied';
  } catch {
    setNote({ kind: 'alert', text: '共有できませんでした' });
    return 'failed';
  }
}

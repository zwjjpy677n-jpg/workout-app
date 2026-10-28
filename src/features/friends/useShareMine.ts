import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getProfile } from '../../db/friends';
import { listExercises, listRoutines, listWorkouts } from '../../db/repository';
import { ShareError } from '../../lib/share/codec';
import { buildShareLink } from '../../lib/share/sharePayload';

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
  const [link, setLink] = useState<Link | ShareError | null>(null);
  const [note, setNote] = useState<ShareNote>(null);

  useEffect(() => {
    if (!src) return setLink(null);
    let alive = true;
    buildShareLink(src, Date.now()).then(
      (l) => alive && setLink(l),
      (e: unknown) => alive && setLink(e instanceof ShareError ? e : new ShareError('invalid')),
    );
    return () => {
      alive = false;
    };
  }, [src]);

  const shareMine = () => {
    setNote(null);
    if (!link) return;
    if (link instanceof ShareError) return setNote({ kind: 'alert', text: ERRORS[link.code] ?? '共有できませんでした' });
    if (link.trimmed && !window.confirm(`直近${link.weeks}週ぶんを共有します`)) return;
    void sendText(link.text, setNote);
  };
  return { ready: link !== null, hasProfile: !!src, shareMine, note };
}

export async function sendText(text: string, setNote: (n: ShareNote) => void) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    setNote({ kind: 'status', text: 'コピーしました。LINE に貼り付けて送ってください' });
  } catch {
    setNote({ kind: 'alert', text: '共有できませんでした' });
  }
}

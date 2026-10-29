import { db } from '../../db/db';
import { getProfile, saveProfileName } from '../../db/friends';
import { getApi } from '../../lib/online/api';
import { flushOutbox } from '../../lib/online/outbox';

export const OFFLINE_NOTE = '今はつながりません。あとで自動で送ります';
export const SENT_NOTE = '送りました';

/** 送り主。ID は端末のプロフィール、名前はオンラインの表示名（無ければプロフィールの名前） */
export async function senderIdentity(): Promise<{ id: string; name: string }> {
  let name: string | null = null;
  try {
    name = (await getApi()?.getMyName())?.trim() || null;
  } catch {
    /* つながらなくても、端末の名前で送れる */
  }
  const profile = (await getProfile()) ?? (await saveProfileName(name ?? 'わたし'));
  return { id: profile.id, name: (name ?? profile.name).slice(0, 40) };
}

export const FAILED_NOTE = '送れませんでした。あとでもう一度送ります';

/** 入れた分をすぐ送ってみる。届いた（outbox から消えた）ときだけ ok */
export async function flushNote(ids: string[]): Promise<{ ok: boolean; text: string }> {
  const r = await flushOutbox();
  if (r === 'offline') return { ok: false, text: OFFLINE_NOTE };
  const left = await db.outbox.bulkGet(ids);
  return left.some(Boolean) ? { ok: false, text: FAILED_NOTE } : { ok: true, text: SENT_NOTE };
}

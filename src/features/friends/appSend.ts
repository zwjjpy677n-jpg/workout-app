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

/** 送る分を入れたあと、すぐ送ってみる。つながらなければ「あとで自動で送る」 */
export async function flushNote(): Promise<string> {
  return (await flushOutbox()) === 'offline' ? OFFLINE_NOTE : SENT_NOTE;
}

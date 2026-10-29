import { getApi } from './api';
import { claimOutbox, flushOutbox } from './outbox';
import { setSession } from './prefs';
import { pullAll } from './pull';
import { OnlineError, type OnlineUser } from './types';

export async function signIn(email: string, code: string): Promise<OnlineUser> {
  const api = getApi();
  if (!api) throw new OnlineError('unknown');
  const user = await api.verifyCode(email, code);
  await claimOutbox(user.userId);
  setSession({ userId: user.userId });
  return user;
}

/** 端末のログイン印だけ消す。送り待ち（outbox）は残す */
export async function signOutOnline(): Promise<void> {
  try {
    await getApi()?.signOut();
  } catch {
    /* 通信できなくても、端末側は外す */
  }
  setSession(null);
}

/** 送り待ちを送って、友達の分を受け取る。失敗は投げず結果で返す */
export async function syncNow(): Promise<'done' | 'offline' | 'skipped'> {
  if (!getApi()) return 'skipped';
  try {
    const f = await flushOutbox();
    const p = await pullAll(Date.now());
    return f === 'offline' || p === 'offline' ? 'offline' : f === 'skipped' && p === 'skipped' ? 'skipped' : 'done';
  } catch (e) {
    if (e instanceof OnlineError && e.code === 'auth') {
      setSession(null);
      return 'skipped';
    }
    return 'offline';
  }
}

let started = false;

/** 起動時と、通信が戻ったとき・画面に戻ったときに同期する。2回呼んでも登録は1回 */
export function startOnlineSync(): void {
  if (started || !getApi()) return;
  started = true;
  const run = () => void syncNow();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
  run();
}

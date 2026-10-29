const AUTO_KEY = 'ironlog:autoShare';
const SESSION_KEY = 'ironlog:onlineSession';
const OWNER_KEY = 'ironlog:outboxOwner';

export function getAutoShare(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAutoShare(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, String(on));
  } catch {
    /* 保存できなくても動く */
  }
}

/** ログイン済みかを端末で素早く判断するための印 */
export function getSession(): { userId: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return v && typeof v.userId === 'string' ? { userId: v.userId } : null;
  } catch {
    return null;
  }
}

export function setSession(s: { userId: string } | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: s.userId }));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 保存できなくても動く */
  }
}

/** 送り予定（outbox）と同期の位置が、どのユーザーのものか */
export function getOutboxOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setOutboxOwner(userId: string): void {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* 保存できなくても動く */
  }
}

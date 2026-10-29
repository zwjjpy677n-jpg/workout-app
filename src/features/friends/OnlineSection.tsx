import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { getApi } from '../../lib/online/api';
import { signIn, syncNow } from '../../lib/online/auth';
import { flushOutbox, queueRecentWorkouts } from '../../lib/online/outbox';
import { getSession } from '../../lib/online/prefs';
import { markFriendsSeen } from '../../lib/online/pull';
import { OnlineError, type OnlineUser } from '../../lib/online/types';
import { PUBLIC_URL } from '../../lib/platform';
import { sendText, type ShareNote } from './useShareMine';
import s from './friends.module.css';

const OFFLINE_TEXT = '今はつながりません。あとで自動で送ります';
const askedKey = (userId: string) => `ironlog:sharedHistoryAsked:${userId}`;
const wasAsked = (userId: string) => {
  try {
    return localStorage.getItem(askedKey(userId)) !== null;
  } catch {
    return false;
  }
};
const markAsked = (userId: string) => {
  try {
    localStorage.setItem(askedKey(userId), '1');
  } catch {
    /* 保存できなくても動く */
  }
};

/** メール → 6桁のコード → （名前が無ければ）表示名。Task 7 の参加ページでも使う */
export function LoginForm({ onDone }: { onDone(user: OnlineUser): void }) {
  const [step, setStep] = useState<'email' | 'code' | 'name'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [user, setUser] = useState<OnlineUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<void>, fail: (e: unknown) => string) => {
    setError(null);
    setBusy(true);
    try {
      await f();
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(false);
    }
  };
  const isOffline = (e: unknown) => e instanceof OnlineError && e.code === 'offline';

  if (step === 'email') {
    return (
      <div>
        <input className={s.text} type="email" inputMode="email" autoComplete="email" aria-label="メールアドレス" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button
          block
          variant="primary"
          disabled={busy || !email.includes('@')}
          onClick={() =>
            run(async () => {
              await getApi()!.sendCode(email.trim());
              setStep('code');
            }, (e) => (isOffline(e) ? OFFLINE_TEXT : 'コードを送れませんでした'))
          }
        >
          コードを送る
        </Button>
        {error && <p role="alert" className={s.error}>{error}</p>}
      </div>
    );
  }
  if (step === 'code') {
    return (
      <div>
        <p className={s.hint}>{email} に届いた6桁のコードを入れてください</p>
        <input className={s.text} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6桁のコード" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <Button
          block
          variant="primary"
          disabled={busy || code.length !== 6}
          onClick={() =>
            run(async () => {
              const u = await signIn(email.trim(), code);
              const existing = await getApi()!.getMyName();
              if (existing) return onDone(u);
              setUser(u);
              setStep('name');
            }, (e) => (isOffline(e) ? OFFLINE_TEXT : 'コードが違うか、期限が切れています'))
          }
        >
          ログイン
        </Button>
        {error && <p role="alert" className={s.error}>{error}</p>}
      </div>
    );
  }
  const v = name.trim();
  return (
    <div>
      <p className={s.hint}>友達に表示する名前を決めてください</p>
      <input className={s.text} aria-label="表示名" placeholder="表示名（1〜20文字）" value={name} onChange={(e) => setName(e.target.value)} />
      <Button
        block
        variant="primary"
        disabled={busy || v.length < 1 || v.length > 20}
        onClick={() =>
          run(async () => {
            await getApi()!.saveMyName(v);
            onDone(user!);
          }, (e) => (isOffline(e) ? OFFLINE_TEXT : '名前を保存できませんでした'))
        }
      >
        保存
      </Button>
      {error && <p role="alert" className={s.error}>{error}</p>}
    </div>
  );
}

/**
 * 友達タブの「オンラインでつながる」。サーバーの窓口（getApi()）が無いときは何も出さない
 * （テストでは setApiForTest で差し替えたときだけ出る。本物は Task 10 以降、環境変数が設定されたとき）
 */
export function OnlineSection() {
  const api = getApi();
  const [userId, setUserId] = useState<string | null>(() => getSession()?.userId ?? null);
  const [ask, setAsk] = useState(false);
  const [offline, setOffline] = useState(false);
  const [note, setNote] = useState<ShareNote>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);

  // 開いたら同期して、見たことにする
  useEffect(() => {
    if (!api || !userId) return;
    let alive = true;
    void syncNow().then(async (r) => {
      if (!alive) return;
      setOffline(r === 'offline');
      if (getSession() === null) return setUserId(null);
      await markFriendsSeen(Date.now());
    });
    return () => {
      alive = false;
    };
  }, [api, userId]);

  // iPhone は共有をタップの直後に呼ぶ必要があるので、招待リンクは前もって作っておく
  const made = useRef(0);
  const prepare = () => {
    const n = ++made.current;
    setLink(null);
    setLinkFailed(false);
    getApi()!
      .createInvite()
      .then((c) => n === made.current && setLink(`キントレ部で友達になろう！ このリンクを開いてね\n${PUBLIC_URL}#/join?c=${c}`))
      .catch(() => n === made.current && setLinkFailed(true));
  };
  useEffect(() => {
    if (api && userId) prepare();
  }, [api, userId]);

  if (!api) return null;

  const done = (u: OnlineUser) => {
    setUserId(u.userId);
    if (!wasAsked(u.userId)) setAsk(true);
  };
  const answer = async (yes: boolean) => {
    if (userId) markAsked(userId);
    setAsk(false);
    if (yes) {
      await queueRecentWorkouts(Date.now());
      setOffline((await flushOutbox()) === 'offline');
    }
  };

  return (
    <section className={s.online}>
      <h2 className={s.onlineTitle}>オンラインでつながる</h2>
      {!userId ? (
        <LoginForm onDone={done} />
      ) : ask ? (
        <div>
          <p className={s.hint}>直近8週間の記録を共有しますか？</p>
          <div className={s.actions}>
            <Button block variant="primary" onClick={() => answer(true)}>はい</Button>
            <Button block onClick={() => answer(false)}>いいえ</Button>
          </div>
        </div>
      ) : (
        <div>
          <Button block variant="primary" disabled={!link && !linkFailed} onClick={() => (link ? void sendText(link, setNote) : prepare())}>
            {linkFailed ? '友達を招待（もう一度）' : '友達を招待'}
          </Button>
          {offline && <p role="status" className={s.hint}>{OFFLINE_TEXT}</p>}
          {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { getApi } from '../../lib/online/api';
import { getSession, setSession } from '../../lib/online/prefs';
import { pullAll } from '../../lib/online/pull';
import { OnlineError } from '../../lib/online/types';
import { LoginForm, NameStep } from './OnlineSection';
import s from './friends.module.css';

const PENDING_KEY = 'ironlog:pendingInvite';
const GONE = 'このリンクはもう使えません。もう一度送ってもらってください';
const OFFLINE_TEXT = '今はつながりません。あとで自動で送ります';

const savePending = (code: string) => {
  try {
    sessionStorage.setItem(PENDING_KEY, code);
  } catch {
    /* 保存できなくても動く */
  }
};
const clearPending = () => {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* 保存できなくても動く */
  }
};

type View = 'working' | 'login' | 'name' | { error: string; retry?: boolean };

/** 招待リンク（#/join?c=...）を開いたとき。ログイン（と名前）を済ませてから友達になる */
export function JoinPage() {
  const [params] = useSearchParams();
  const code = params.get('c');
  const navigate = useNavigate();
  const [view, setView] = useState<View>('working');
  const started = useRef(false);

  const fail = (error: string) => {
    clearPending();
    setView({ error });
  };

  const accept = async () => {
    setView('working');
    try {
      const friend = await getApi()!.acceptInvite(code!);
      clearPending();
      try {
        await pullAll(Date.now());
      } catch {
        /* 取り込みは失敗しても友達にはなれている */
      }
      navigate(`/friends/${friend.userId}`, { replace: true });
    } catch (e) {
      const c = e instanceof OnlineError ? e.code : null;
      if (c === 'self') return fail('自分の招待リンクです');
      if (c === 'used' || c === 'expired' || c === 'invalid') return fail(GONE);
      if (c === 'auth') {
        setSession(null);
        return setView('login');
      }
      if (c === 'offline') return setView({ error: OFFLINE_TEXT, retry: true });
      fail('友達になれませんでした');
    }
  };

  // ログイン済みなら、名前があることを確かめてから受け取る（名前が無いと受け取れない）
  const start = async () => {
    setView('working');
    try {
      const name = await getApi()!.getMyName();
      if (!name) return setView('name');
    } catch (e) {
      const c = e instanceof OnlineError ? e.code : null;
      if (c === 'auth') {
        setSession(null);
        return setView('login');
      }
      return setView({ error: OFFLINE_TEXT, retry: true });
    }
    await accept();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) return fail(GONE);
    if (!getApi()) return fail('この版ではオンライン機能が使えません');
    savePending(code);
    if (!getSession()) return setView('login');
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={s.online}>
      <h1 className={s.onlineTitle}>友達の招待</h1>
      {view === 'working' && <p role="status" className={s.hint}>友達になっています…</p>}
      {view === 'login' && <LoginForm onDone={() => void accept()} />}
      {view === 'name' && <NameStep onSaved={() => void accept()} />}
      {typeof view === 'object' && (
        <div>
          <p role="alert" className={s.error}>{view.error}</p>
          {view.retry && (
            <Button block variant="primary" onClick={() => void start()}>
              もう一度
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

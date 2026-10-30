import { useEffect, useState } from 'react';
import { getApi } from '../../lib/online/api';
import { signOutOnline } from '../../lib/online/auth';
import { getAutoShare, getSession, setAutoShare } from '../../lib/online/prefs';
import s from './manage.module.css';

/** 設定の「アカウント」。ログイン済みで、サーバーの窓口があるときだけ出る */
export function AccountSection() {
  const api = getApi();
  const [loggedIn, setLoggedIn] = useState(() => getSession() !== null);
  const [email, setEmail] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<'ok' | 'ng' | null>(null);
  const [auto, setAuto] = useState(getAutoShare);

  useEffect(() => {
    if (!api || !loggedIn) return;
    let alive = true;
    api.currentUser().then(
      (u) => {
        if (!alive) return;
        setEmail(u?.email || null);
        setAnonymous(!!u?.anonymous);
      },
      () => {},
    );
    api.getMyName().then((n) => alive && (setName(n ?? ''), setLoaded(true)), () => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [api, loggedIn]);

  if (!api || !loggedIn) return null;
  const v = name.trim();

  const save = async () => {
    setNote(null);
    try {
      await api.saveMyName(v);
      setNote('ok');
    } catch {
      setNote('ng');
    }
  };

  const logout = async () => {
    const msg = anonymous
      ? 'ログアウトしますか？ メールなしのアカウントなので、ログアウトするともうこのアカウントには戻れません（友達やグループもやり直しになります）。端末の記録は消えません'
      : 'ログアウトしますか？ 端末の記録は消えません';
    if (!window.confirm(msg)) return;
    await signOutOnline();
    setLoggedIn(false);
  };

  return (
    <section className={s.field}>
      <h2>アカウント</h2>
      {email && <span>{email}</span>}
      {anonymous && <span>メールなし（この端末だけのアカウント）</span>}
      <label className={s.field}>
        <span>表示名</span>
        <input
          className={s.text}
          aria-label="表示名"
          value={name}
          disabled={!loaded}
          onChange={(e) => {
            setName(e.target.value);
            setNote(null);
          }}
        />
      </label>
      <button type="button" className={s.testBtn} disabled={!loaded || v.length < 1 || v.length > 20} onClick={save}>
        保存
      </button>
      {note === 'ok' && <p role="status" className={s.ok}>保存しました</p>}
      {note === 'ng' && <p role="alert" className={s.error}>保存できませんでした</p>}
      <label className={s.check}>
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAutoShare(e.target.checked);
            setAuto(e.target.checked);
          }}
        />
        自動共有
      </label>
      <small className={s.hint}>トレーニングを終えると、友達に自動で表示されます</small>
      <button type="button" className={s.testBtn} onClick={logout}>
        ログアウト
      </button>
    </section>
  );
}

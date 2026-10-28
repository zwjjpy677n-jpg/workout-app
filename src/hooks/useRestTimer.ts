import { useCallback, useEffect, useState } from 'react';

type State = { endAt: number; total: number; remaining: number; running: boolean; finished: boolean };

const KEY = 'ironlog:rest';
const FINISHED_MS = 8000;

const secsLeft = (endAt: number) => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

// 再読み込みしてもレストが続くよう、終了時刻だけ端末に残す（この端末だけの便宜機能）
function load(): State {
  const idle = { endAt: 0, total: 0, remaining: 0, running: false, finished: false };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { endAt: number; total: number } | null;
    if (v && v.endAt > Date.now()) return { endAt: v.endAt, total: v.total, remaining: secsLeft(v.endAt), running: true, finished: false };
  } catch {
    // 保存領域が使えない環境では再読み込みで消えるだけ
  }
  return idle;
}

function persist(st: { endAt: number; total: number } | null) {
  try {
    if (st) localStorage.setItem(KEY, JSON.stringify(st));
    else localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}

export function useRestTimer() {
  const [st, setSt] = useState<State>(load);

  useEffect(() => {
    if (!st.running) return;
    const id = setInterval(() => {
      setSt((cur) => {
        const remaining = secsLeft(cur.endAt);
        if (remaining > 0) return { ...cur, remaining };
        navigator.vibrate?.(300);
        persist(null);
        return { ...cur, remaining: 0, running: false, finished: true };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [st.running]);

  // 終了表示は一定時間で自動的に消す
  useEffect(() => {
    if (!st.finished) return;
    const id = setTimeout(() => setSt((cur) => ({ ...cur, finished: false })), FINISHED_MS);
    return () => clearTimeout(id);
  }, [st.finished]);

  const start = useCallback((sec: number) => {
    const endAt = Date.now() + sec * 1000;
    persist(sec > 0 ? { endAt, total: sec } : null);
    setSt({ endAt, total: sec, remaining: sec, running: sec > 0, finished: false });
  }, []);

  const add = useCallback((sec: number) => {
    setSt((cur) => {
      const remaining = Math.max(0, cur.remaining + sec);
      const endAt = Date.now() + remaining * 1000;
      const total = Math.max(cur.total + sec, remaining);
      persist(remaining > 0 ? { endAt, total } : null);
      return { endAt, total, remaining, running: remaining > 0, finished: false };
    });
  }, []);

  const skip = useCallback(() => {
    persist(null);
    setSt((cur) => ({ ...cur, remaining: 0, running: false, finished: false }));
  }, []);

  const dismiss = useCallback(() => setSt((cur) => ({ ...cur, finished: false })), []);

  return { remaining: st.remaining, total: st.total, running: st.running, finished: st.finished, start, add, skip, dismiss };
}

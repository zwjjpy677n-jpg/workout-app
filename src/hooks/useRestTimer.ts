import { useCallback, useEffect, useState } from 'react';

type State = { endAt: number; total: number; remaining: number; running: boolean };

const secsLeft = (endAt: number) => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

export function useRestTimer() {
  const [st, setSt] = useState<State>({ endAt: 0, total: 0, remaining: 0, running: false });

  useEffect(() => {
    if (!st.running) return;
    const id = setInterval(() => {
      setSt((cur) => {
        const remaining = secsLeft(cur.endAt);
        if (remaining > 0) return { ...cur, remaining };
        navigator.vibrate?.(300);
        return { ...cur, remaining: 0, running: false };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [st.running]);

  const start = useCallback((sec: number) => {
    setSt({ endAt: Date.now() + sec * 1000, total: sec, remaining: sec, running: sec > 0 });
  }, []);

  const add = useCallback((sec: number) => {
    setSt((cur) => {
      const remaining = Math.max(0, cur.remaining + sec);
      return { endAt: Date.now() + remaining * 1000, total: Math.max(cur.total + sec, remaining), remaining, running: remaining > 0 };
    });
  }, []);

  const skip = useCallback(() => setSt((cur) => ({ ...cur, remaining: 0, running: false })), []);

  return { remaining: st.remaining, total: st.total, running: st.running, start, add, skip };
}

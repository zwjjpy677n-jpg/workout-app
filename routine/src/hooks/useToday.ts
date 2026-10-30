import { useEffect, useState } from 'react';
import { toDateKey } from '../../../src/lib/dates';

/** 今日の日付キー。開きっぱなしで日付をまたいでも、画面に戻ったときに計算し直す */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(Date.now()));
  useEffect(() => {
    const update = () => setToday(toDateKey(Date.now()));
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
}

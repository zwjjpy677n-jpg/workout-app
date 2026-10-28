import { useEffect, useState } from 'react';

/** 今の時刻。日付が変わった瞬間に更新される（開きっぱなしの画面でも「今日」が古くならない） */
export function useToday(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const d = new Date(now);
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const id = setTimeout(() => setNow(Date.now()), nextMidnight - Date.now() + 500);
    return () => clearTimeout(id);
  }, [now]);
  return now;
}

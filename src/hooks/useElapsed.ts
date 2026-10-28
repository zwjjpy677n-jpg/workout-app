import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatHMS(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

export function useElapsed(startedAt: number): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return formatHMS(now - startedAt);
}

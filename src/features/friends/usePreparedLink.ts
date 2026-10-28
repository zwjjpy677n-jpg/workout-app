import { useEffect, useState } from 'react';
import { ShareError } from '../../lib/share/codec';

/**
 * リンクを前もって作っておく（deps が変わるたびに作り直し、古い結果は捨てる）。
 * iPhone の Safari はタップの直後でないと共有画面を出せないので、押してから作るのでは間に合わない
 */
export function usePreparedLink<T>(build: (() => Promise<T>) | null, deps: unknown[]): T | ShareError | null {
  const [value, setValue] = useState<T | ShareError | null>(null);
  useEffect(() => {
    if (!build) return setValue(null);
    let alive = true;
    setValue(null);
    build().then(
      (v) => alive && setValue(v),
      (e: unknown) => alive && setValue(e instanceof ShareError ? e : new ShareError('invalid')),
    );
    return () => {
      alive = false;
    };
  }, deps);
  return value;
}

import { useEffect } from 'react';

type Sentinel = { release(): Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

/** active の間は画面が自動で消えないようにする（レストの音を確実に届けるため）。非対応端末では何もしない */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as WakeLockNav).wakeLock;
    if (!active || !wl) return;
    let lock: Sentinel | null = null;
    let done = false;
    const acquire = async () => {
      try {
        const l = await wl.request('screen');
        if (done) void l.release();
        else lock = l;
      } catch {
        // 省電力モードなどで断られたら諦める
      }
    };
    // 別アプリから戻ると解除されているので取り直す
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

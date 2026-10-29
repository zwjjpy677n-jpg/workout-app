import { isNativeApp } from './platform';

/**
 * Web 版だけ Service Worker（オフライン用）を登録する。アプリの更新は App Store 経由なので登録しない。
 * 新しい版が出ても、記録中にページを勝手に再読み込みしないよう、登録だけ行う（次に開いたときに新しい版になる）
 */
export function registerServiceWorker(): void {
  if (isNativeApp() || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

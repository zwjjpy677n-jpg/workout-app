import { registerSW } from 'virtual:pwa-register';
import { isNativeApp } from './platform';

/** Web 版だけ Service Worker（オフライン・自動更新）を登録する。アプリの更新は App Store 経由 */
export function registerServiceWorker(): void {
  if (isNativeApp()) return;
  registerSW({ immediate: true });
}

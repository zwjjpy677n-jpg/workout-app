import { Capacitor } from '@capacitor/core';

/** iPhone アプリ（Capacitor）の中で動いているか。Web 版（ブラウザ・ホーム画面）では false */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

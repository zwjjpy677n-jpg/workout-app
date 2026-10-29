import { Capacitor } from '@capacitor/core';

/** iPhone アプリ（Capacitor）の中で動いているか。Web 版（ブラウザ・ホーム画面）では false */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** 公開している Web 版の URL。アプリから友達に送るリンクはこちらで作る（アプリ内の URL は友達が開けない） */
export const PUBLIC_URL = 'https://zwjjpy677n-jpg.github.io/workout-app/';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** ランダムな英数字12文字（自分の ID・フィードバックやメニュー送信の ID） */
export const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALNUM[b % ALNUM.length]).join('');

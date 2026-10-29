import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';
import { getSoundPrefs } from './sound';

// アプリでだけ、レスト終了を iPhone の通知で予約する（画面を消していても届く）。失敗してもタイマーは止めない
const ID = 1;

export async function cancelRestEnd(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
  } catch {
    // 予約が無い・失敗しても何もしない
  }
}

/** 前の予約を取り消して endAt に1件だけ予約する。音の設定がオフ・通知を許可しない場合は予約しない */
export async function scheduleRestEnd(endAt: number): Promise<void> {
  if (!isNativeApp()) return;
  await cancelRestEnd();
  if (!getSoundPrefs().on) return;
  try {
    if ((await LocalNotifications.requestPermissions()).display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [{ id: ID, title: 'レスト終了', body: '次のセットへ', schedule: { at: new Date(endAt), allowWhileIdle: true } }],
    });
  } catch {
    // 同上
  }
}

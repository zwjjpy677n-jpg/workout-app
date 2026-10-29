import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

// 振動。アプリでは iPhone の振動、Web では使えるブラウザだけ navigator.vibrate。失敗しても何もしない

/** セットを完了にしたとき（Web では振動しない） */
export function tap(): void {
  if (isNativeApp()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** レストが終わったとき */
export function notifyEnd(): void {
  if (isNativeApp()) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  else navigator.vibrate?.(300);
}

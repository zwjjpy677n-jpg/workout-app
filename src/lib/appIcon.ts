import { AppIcon } from '@capacitor-community/app-icon';
import type { IconKey } from './appearance';
import { isNativeApp } from './platform';

// ホーム画面のアイコンを変える。
// アプリ: iPhone の別アイコン（AppIcon-<色>。赤は標準アイコン）。iPhone が「アイコンを変更しました」と出す
// Web: 一度追加したアイコンは変えられない。追加し直すと選んだ色になる（appearance が apple-touch-icon を差し替える）
export async function changeAppIcon(key: IconKey): Promise<'changed' | 'reinstall' | 'failed'> {
  if (!isNativeApp()) return 'reinstall';
  try {
    if (!(await AppIcon.isSupported()).value) return 'failed';
    if (key === 'red') await AppIcon.reset({ suppressNotification: false });
    else await AppIcon.change({ name: `AppIcon-${key}`, suppressNotification: false });
    return 'changed';
  } catch {
    return 'failed';
  }
}

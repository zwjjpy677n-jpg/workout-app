/**
 * ホーム画面に追加したアプリとして開いているとき、html に standalone を付ける。
 * iPhone はこのとき上の時計の分を引いた高さしか渡さないので、CSS で --vgap として足し戻す
 */
export function markStandalone(win: Window = window): void {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const media = win.matchMedia?.('(display-mode: standalone)').matches ?? false;
  if (nav.standalone === true || media) document.documentElement.classList.add('standalone');
}

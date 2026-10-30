/**
 * ホーム画面に追加したアプリとして開いているとき、html に standalone を付ける。
 * iPhone はこのとき上の時計の分を引いた高さしか渡さない（実機: 画面 852 / 使える高さ 793）。
 * その差を開いたとき（キーボードが出ていないとき）に一度だけ測って --vgap に固定し、CSS で足し戻す。
 * dvh などで毎回計算すると、キーボードが出たときに差が大きくなり、シートの保存ボタンが隠れる
 */
export function markStandalone(win: Window = window): void {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const media = win.matchMedia?.('(display-mode: standalone)').matches ?? false;
  if (nav.standalone !== true && !media) return;
  const root = document.documentElement;
  root.classList.add('standalone');
  const gap = win.screen.height - win.innerHeight;
  // 上の時計の分（60px 前後）だけを足す。それより大きいのはキーボードなど別の理由なので足さない
  root.style.setProperty('--vgap', `${gap > 0 && gap <= 100 ? gap : 0}px`);
}

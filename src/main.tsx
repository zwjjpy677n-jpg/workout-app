import { bootstrap } from './bootstrap';
import { applyAppearance, getAppearance } from './lib/appearance';
import { markStandalone } from './lib/standalone';
// フォントはアプリに同梱する（外部の Google Fonts に通信しない・オフラインでも同じ見た目）
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import './styles/tokens.css';
import './styles/global.css';

// 選んだ色を最初の描画より前に反映する（赤が一瞬見えないように）
applyAppearance(getAppearance());
markStandalone();

async function start() {
  // 開発用: ?fake-online を付けると、サーバーの代わりにメモリ上の偽サーバーを使う（本番のビルドには入らない）
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('fake-online')) {
    const [{ setApiForTest }, { createFakeApi }] = await Promise.all([import('./lib/online/api'), import('./lib/online/fakeApi')]);
    const api = createFakeApi();
    setApiForTest(api);
    (window as unknown as { __fakeOnline: unknown }).__fakeOnline = api;
  }
  bootstrap(document.getElementById('root')!);
}
void start();

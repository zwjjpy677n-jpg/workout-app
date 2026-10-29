import { bootstrap } from './bootstrap';
import { applyAppearance, getAppearance } from './lib/appearance';
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
bootstrap(document.getElementById('root')!);

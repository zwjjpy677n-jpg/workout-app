import { bootstrap } from './bootstrap';
// フォントはアプリに同梱する（外部の Google Fonts に通信しない・オフラインでも同じ見た目）
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import './styles/tokens.css';
import './styles/global.css';

bootstrap(document.getElementById('root')!);

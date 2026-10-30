import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { seedIfEmpty } from './db/seed';
// フォントと色は GRIND と同じものを使い、アクセント色だけ上書きする
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import '../../src/styles/tokens.css';
import '../../src/styles/global.css';
import './styles/accent.css';

void seedIfEmpty(Date.now());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </StrictMode>,
);

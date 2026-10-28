import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { checkStorage } from './db/checkStorage';
import { ensureSeeded } from './db/seed';
import { ensureMenuSeeded } from './db/menuSeed';

export async function bootstrap(el: HTMLElement): Promise<void> {
  const root = createRoot(el);
  if (!(await checkStorage())) {
    root.render(
      <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h1 className="page-title">IRON<span style={{ color: 'var(--red)' }}>LOG</span></h1>
        <p>この環境ではデータを保存できません。プライベートモードを解除してください。</p>
      </div>,
    );
    return;
  }
  await ensureSeeded();
  await ensureMenuSeeded();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

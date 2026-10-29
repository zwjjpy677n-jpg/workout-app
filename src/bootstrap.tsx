import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Brand } from './components/Brand';
import { checkStorage } from './db/checkStorage';
import { ensureSeeded } from './db/seed';
import { ensureMenuSeeded } from './db/menuSeed';
import { registerServiceWorker } from './lib/registerSW';

export async function bootstrap(el: HTMLElement): Promise<void> {
  registerServiceWorker();
  const root = createRoot(el);
  const fail = (msg: string) =>
    root.render(
      <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Brand size={32} />
        </div>
        <p>{msg}</p>
      </div>,
    );
  if (!(await checkStorage())) return fail('この環境ではデータを保存できません。プライベートモードを解除してください。');
  try {
    await ensureSeeded();
    await ensureMenuSeeded();
  } catch {
    return fail('データの準備に失敗しました。端末の空き容量を確認して、ページを再読み込みしてください。');
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { checkStorage } from './db/checkStorage';
import { ensureSeeded } from './db/seed';
import { ensureMenuSeeded } from './db/menuSeed';

export async function bootstrap(el: HTMLElement): Promise<void> {
  const root = createRoot(el);
  const fail = (msg: string) =>
    root.render(
      <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h1 className="page-title">IRON<span style={{ color: 'var(--red)' }}>LOG</span></h1>
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

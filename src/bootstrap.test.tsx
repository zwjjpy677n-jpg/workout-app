import { screen, within } from '@testing-library/react';
import { act } from 'react';
import { checkStorage } from './db/checkStorage';
import { bootstrap } from './bootstrap';

afterEach(() => vi.unstubAllGlobals());

test('checkStorage: IndexedDBが使えれば true', async () => {
  expect(await checkStorage()).toBe(true);
});

test('checkStorage: IndexedDBが無ければ false', async () => {
  vi.stubGlobal('indexedDB', undefined);
  expect(await checkStorage()).toBe(false);
});

test('checkStorage: open が失敗すれば false', async () => {
  vi.stubGlobal('indexedDB', {
    open() {
      const req: { onerror?: () => void; onsuccess?: () => void; onupgradeneeded?: () => void } = {};
      setTimeout(() => req.onerror?.());
      return req;
    },
  });
  expect(await checkStorage()).toBe(false);
});

test('bootstrap: 保存できない環境ではメッセージを表示', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const root = document.createElement('div');
  document.body.appendChild(root);
  await act(() => bootstrap(root));
  expect(screen.getByText('この環境ではデータを保存できません。プライベートモードを解除してください。')).toBeInTheDocument();
});

test('bootstrap: 通常はアプリを表示し種目をシード', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  await act(() => bootstrap(root));
  expect(await screen.findByRole('link', { name: 'ホーム' })).toBeInTheDocument();
});

test('bootstrap: 初期データの準備に失敗したらエラー画面', async () => {
  const { db } = await import('./db/db');
  vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('QuotaExceededError'));
  const root = document.createElement('div');
  document.body.appendChild(root);
  await act(() => bootstrap(root));
  expect(screen.getByText('データの準備に失敗しました。端末の空き容量を確認して、ページを再読み込みしてください。')).toBeInTheDocument();
});

test('エラー画面にもアプリ名 GRIND', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const root = document.createElement('div');
  document.body.appendChild(root);
  await act(() => bootstrap(root));
  expect(within(root).getByLabelText('GRIND')).toBeInTheDocument();
});

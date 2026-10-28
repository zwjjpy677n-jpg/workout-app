import { screen } from '@testing-library/react';
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

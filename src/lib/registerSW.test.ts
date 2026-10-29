const { native } = vi.hoisted(() => ({ native: { value: false } }));
vi.mock('./platform', () => ({ isNativeApp: () => native.value }));

import { registerServiceWorker } from './registerSW';

const register = vi.fn();
beforeEach(() => {
  register.mockReset().mockResolvedValue({});
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
});

test('Web では読み込み後に sw.js を登録するだけ（更新で勝手に再読み込みしない）', () => {
  native.value = false;
  registerServiceWorker();
  expect(register).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('load'));
  expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' });
});

test('アプリでは登録しない（更新は App Store 経由）', () => {
  native.value = true;
  const add = vi.spyOn(window, 'addEventListener');
  registerServiceWorker();
  expect(add).not.toHaveBeenCalledWith('load', expect.anything());
  expect(register).not.toHaveBeenCalled();
});

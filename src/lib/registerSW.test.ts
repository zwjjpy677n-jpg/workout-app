const { registerSW, native } = vi.hoisted(() => ({ registerSW: vi.fn(), native: { value: false } }));
vi.mock('virtual:pwa-register', () => ({ registerSW }));
vi.mock('./platform', () => ({ isNativeApp: () => native.value }));

import { registerServiceWorker } from './registerSW';

beforeEach(() => registerSW.mockReset());

test('Web では Service Worker を登録する', () => {
  native.value = false;
  registerServiceWorker();
  expect(registerSW).toHaveBeenCalledWith({ immediate: true });
});

test('アプリでは登録しない（更新は App Store 経由）', () => {
  native.value = true;
  registerServiceWorker();
  expect(registerSW).not.toHaveBeenCalled();
});

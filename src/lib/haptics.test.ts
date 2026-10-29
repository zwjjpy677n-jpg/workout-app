const { native, hp } = vi.hoisted(() => ({ native: { value: true }, hp: { impact: vi.fn(), notification: vi.fn() } }));
vi.mock('./platform', async (orig) => ({ ...(await orig<typeof import('./platform')>()), isNativeApp: () => native.value }));
vi.mock('@capacitor/haptics', () => ({ Haptics: hp, ImpactStyle: { Light: 'LIGHT' }, NotificationType: { Success: 'SUCCESS' } }));

import { notifyEnd, tap } from './haptics';

const vibrate = vi.fn();
beforeEach(() => {
  hp.impact.mockReset().mockResolvedValue(undefined);
  hp.notification.mockReset().mockResolvedValue(undefined);
  vibrate.mockReset();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});

test('アプリではセット完了で Light、レスト終了で Success', () => {
  native.value = true;
  tap();
  notifyEnd();
  expect(hp.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  expect(hp.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
  expect(vibrate).not.toHaveBeenCalled();
});

test('Web ではレスト終了で vibrate(300)、セット完了では何もしない', () => {
  native.value = false;
  tap();
  notifyEnd();
  expect(vibrate).toHaveBeenCalledTimes(1);
  expect(vibrate).toHaveBeenCalledWith(300);
  expect(hp.impact).not.toHaveBeenCalled();
});

test('プラグインが失敗しても例外を出さない', async () => {
  native.value = true;
  hp.impact.mockRejectedValue(new Error('x'));
  expect(() => tap()).not.toThrow();
  await Promise.resolve();
});

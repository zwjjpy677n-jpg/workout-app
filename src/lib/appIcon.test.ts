const { native, ai } = vi.hoisted(() => ({
  native: { value: true },
  ai: { isSupported: vi.fn(), change: vi.fn(), reset: vi.fn() },
}));
vi.mock('./platform', async (orig) => ({ ...(await orig<typeof import('./platform')>()), isNativeApp: () => native.value }));
vi.mock('@capacitor-community/app-icon', () => ({ AppIcon: ai }));

import { changeAppIcon } from './appIcon';

beforeEach(() => {
  native.value = true;
  ai.isSupported.mockReset().mockResolvedValue({ value: true });
  ai.change.mockReset().mockResolvedValue(undefined);
  ai.reset.mockReset().mockResolvedValue(undefined);
});

test('アプリで赤なら reset', async () => {
  expect(await changeAppIcon('red')).toBe('changed');
  expect(ai.reset).toHaveBeenCalledWith({ suppressNotification: false });
  expect(ai.change).not.toHaveBeenCalled();
});

test('アプリで黄なら AppIcon-yellow に change', async () => {
  expect(await changeAppIcon('yellow')).toBe('changed');
  expect(ai.change).toHaveBeenCalledWith({ name: 'AppIcon-yellow', suppressNotification: false });
});

test('非対応なら failed', async () => {
  ai.isSupported.mockResolvedValue({ value: false });
  expect(await changeAppIcon('blue')).toBe('failed');
  expect(ai.change).not.toHaveBeenCalled();
});

test('失敗したら failed', async () => {
  ai.change.mockRejectedValue(new Error('nope'));
  expect(await changeAppIcon('pink')).toBe('failed');
});

test('Web ではプラグインを呼ばず reinstall', async () => {
  native.value = false;
  expect(await changeAppIcon('mint')).toBe('reinstall');
  expect(ai.isSupported).not.toHaveBeenCalled();
  expect(ai.change).not.toHaveBeenCalled();
});

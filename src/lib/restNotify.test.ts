const { native, ln } = vi.hoisted(() => ({
  native: { value: true },
  ln: { requestPermissions: vi.fn(), schedule: vi.fn(), cancel: vi.fn() },
}));
vi.mock('./platform', async (orig) => ({ ...(await orig<typeof import('./platform')>()), isNativeApp: () => native.value }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));

import { cancelRestEnd, scheduleRestEnd } from './restNotify';
import { setSoundPrefs } from './sound';

const END = new Date(2026, 9, 29, 10, 1, 30).getTime();

beforeEach(() => {
  native.value = true;
  ln.requestPermissions.mockReset().mockResolvedValue({ display: 'granted' });
  ln.schedule.mockReset().mockResolvedValue({ notifications: [] });
  ln.cancel.mockReset().mockResolvedValue(undefined);
});

test('許可されたら、前の予約を取り消してから ID 1 で endAt に予約する', async () => {
  await scheduleRestEnd(END);
  expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
  expect(ln.schedule).toHaveBeenCalledWith({
    notifications: [{ id: 1, title: 'レスト終了', body: '次のセットへ', schedule: { at: new Date(END), allowWhileIdle: true } }],
  });
  expect(ln.cancel.mock.invocationCallOrder[0]).toBeLessThan(ln.schedule.mock.invocationCallOrder[0]);
});

test('許可されなければ予約しない', async () => {
  ln.requestPermissions.mockResolvedValue({ display: 'denied' });
  await scheduleRestEnd(END);
  expect(ln.schedule).not.toHaveBeenCalled();
});

test('音の設定がオフなら予約しない（取り消しだけ）', async () => {
  setSoundPrefs({ on: false, silent: false });
  await scheduleRestEnd(END);
  expect(ln.schedule).not.toHaveBeenCalled();
  expect(ln.cancel).toHaveBeenCalled();
});

test('プラグインが失敗しても例外を出さない', async () => {
  ln.schedule.mockRejectedValue(new Error('x'));
  ln.cancel.mockRejectedValue(new Error('y'));
  await expect(scheduleRestEnd(END)).resolves.toBeUndefined();
  await expect(cancelRestEnd()).resolves.toBeUndefined();
});

test('Web では何も呼ばない', async () => {
  native.value = false;
  await scheduleRestEnd(END);
  await cancelRestEnd();
  expect(ln.requestPermissions).not.toHaveBeenCalled();
  expect(ln.schedule).not.toHaveBeenCalled();
  expect(ln.cancel).not.toHaveBeenCalled();
});

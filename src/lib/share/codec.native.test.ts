const { native } = vi.hoisted(() => ({ native: { value: true } }));
vi.mock('../platform', async (orig) => ({ ...(await orig<typeof import('../platform')>()), isNativeApp: () => native.value }));

import { shareUrl } from './codec';

test('アプリでは共有リンクが公開サイトの URL（capacitor://localhost にしない）', () => {
  native.value = true;
  expect(shareUrl('r1abc')).toBe('https://zwjjpy677n-jpg.github.io/workout-app/#/friends/add?d=r1abc');
});

test('Web では今まで通り開いているページの URL', () => {
  native.value = false;
  expect(shareUrl('r1abc')).toBe(`${location.origin}${location.pathname}#/friends/add?d=r1abc`);
});

import { markStandalone } from './standalone';

afterEach(() => document.documentElement.classList.remove('standalone'));

const win = (standalone: boolean | undefined, media: boolean) =>
  ({ navigator: { standalone }, matchMedia: () => ({ matches: media }) }) as unknown as Window;

test('ホーム画面に追加したアプリとして開いたら html に standalone を付ける', () => {
  markStandalone(win(true, false));
  expect(document.documentElement.classList.contains('standalone')).toBe(true);
});

test('display-mode: standalone でも付ける', () => {
  markStandalone(win(undefined, true));
  expect(document.documentElement.classList.contains('standalone')).toBe(true);
});

test('Safari のタブで開いたときは付けない', () => {
  markStandalone(win(false, false));
  expect(document.documentElement.classList.contains('standalone')).toBe(false);
});

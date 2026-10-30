import { markStandalone } from './standalone';

const root = document.documentElement;
afterEach(() => {
  root.classList.remove('standalone');
  root.style.removeProperty('--vgap');
});

const win = (standalone: boolean | undefined, media: boolean, screenH = 852, innerH = 793) =>
  ({ navigator: { standalone }, matchMedia: () => ({ matches: media }), screen: { height: screenH }, innerHeight: innerH }) as unknown as Window;

test('ホーム画面アプリでは、開いたときの画面と使える高さの差を --vgap に固定する（キーボードで変わらない）', () => {
  markStandalone(win(true, false));
  expect(root.classList.contains('standalone')).toBe(true);
  expect(root.style.getPropertyValue('--vgap')).toBe('59px');
});

test('display-mode: standalone でも同じ', () => {
  markStandalone(win(undefined, true));
  expect(root.style.getPropertyValue('--vgap')).toBe('59px');
});

test('差が無い端末では 0px', () => {
  markStandalone(win(true, false, 852, 852));
  expect(root.style.getPropertyValue('--vgap')).toBe('0px');
});

test('差がおかしく大きいとき（キーボードが出ているなど）は足さない', () => {
  markStandalone(win(true, false, 852, 500));
  expect(root.style.getPropertyValue('--vgap')).toBe('0px');
});

test('Safari のタブで開いたときは何もしない', () => {
  markStandalone(win(false, false));
  expect(root.classList.contains('standalone')).toBe(false);
  expect(root.style.getPropertyValue('--vgap')).toBe('');
});

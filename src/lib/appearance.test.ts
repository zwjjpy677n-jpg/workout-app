import { applyAppearance, DEFAULT_APPEARANCE, getAppearance, setAppearance, subscribeAppearance } from './appearance';

const KEY = 'ironlog:appearance';
const css = (name: string) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.head.innerHTML = '<meta name="theme-color" content="#0B0B0D"><link rel="apple-touch-icon" href="./apple-touch-icon.png">';
});
afterEach(() => vi.restoreAllMocks());

test('既定は赤アイコン・赤・黒', () => {
  expect(getAppearance()).toEqual({ icon: 'red', accent: 'red', bg: 'black' });
  expect(DEFAULT_APPEARANCE).toEqual({ icon: 'red', accent: 'red', bg: 'black' });
});

test('保存したものが読める', () => {
  setAppearance({ icon: 'yellow', accent: 'blue', bg: 'navy' });
  expect(getAppearance()).toEqual({ icon: 'yellow', accent: 'blue', bg: 'navy' });
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ icon: 'yellow', accent: 'blue', bg: 'navy' });
});

test('壊れた項目だけ既定に戻る', () => {
  localStorage.setItem(KEY, JSON.stringify({ icon: 'yellow', accent: 'gold', bg: 5 }));
  expect(getAppearance()).toEqual({ icon: 'yellow', accent: 'red', bg: 'black' });
  localStorage.setItem(KEY, '{oops');
  expect(getAppearance()).toEqual({ icon: 'red', accent: 'red', bg: 'black' });
});

test('localStorage が使えなくても既定で動く', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(getAppearance()).toEqual(DEFAULT_APPEARANCE);
  expect(() => setAppearance({ icon: 'pink', accent: 'pink', bg: 'brown' })).not.toThrow();
  expect(css('--red')).toBe('#FF6FA8');
});

test('適用すると CSS 変数・theme-color・ホーム画面アイコンが変わる', () => {
  applyAppearance({ icon: 'mint', accent: 'yellow', bg: 'navy' });
  expect(css('--red')).toBe('#FFC21A');
  expect(css('--on-accent')).toBe('#111');
  expect(css('--red-soft')).toBe('rgb(255 194 26 / 0.15)');
  expect(css('--red-rgb')).toBe('255 194 26');
  expect(css('--bg-rgb')).toBe('10 15 30');
  expect(css('--bg-deep')).toBe('rgb(6 9 18)');
  expect(css('--bg')).toBe('#0A0F1E');
  expect(css('--surface')).toBe('#131A2C');
  expect(css('--surface2')).toBe('#1B2338');
  expect(css('--line')).toBe('#283149');
  expect(document.querySelector('meta[name=theme-color]')!.getAttribute('content')).toBe('#0A0F1E');
  expect(document.querySelector('link[rel=apple-touch-icon]')!.getAttribute('href')).toMatch(/\.\/icons\/mint-180\.png$/);
});

test('赤は今と同じ見た目', () => {
  applyAppearance(DEFAULT_APPEARANCE);
  expect(css('--red')).toBe('#E10600');
  expect(css('--on-accent')).toBe('#fff');
  expect(css('--bg')).toBe('#0B0B0D');
});

test('meta や link が無くても適用できる', () => {
  document.head.innerHTML = '';
  expect(() => applyAppearance({ icon: 'blue', accent: 'blue', bg: 'forest' })).not.toThrow();
  expect(css('--bg')).toBe('#08120E');
});

test('変えると購読者に通知される', () => {
  const fn = vi.fn();
  const off = subscribeAppearance(fn);
  setAppearance({ icon: 'red', accent: 'green', bg: 'black' });
  expect(fn).toHaveBeenCalledTimes(1);
  off();
  setAppearance({ icon: 'red', accent: 'red', bg: 'black' });
  expect(fn).toHaveBeenCalledTimes(1);
});

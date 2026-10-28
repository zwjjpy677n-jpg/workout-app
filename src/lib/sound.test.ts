import { beep, getSoundPrefs, setSoundPrefs } from './sound';

test('音の設定は既定でオン・マナーモード中は鳴らさない。端末に保存される', () => {
  expect(getSoundPrefs()).toEqual({ on: true, silent: false });
  setSoundPrefs({ on: false, silent: true });
  expect(getSoundPrefs()).toEqual({ on: false, silent: true });
});

test('壊れた保存値は既定に戻す', () => {
  localStorage.setItem('ironlog:sound', '{');
  expect(getSoundPrefs()).toEqual({ on: true, silent: false });
});

test('音が出せない環境でも beep は落ちない', () => {
  expect(() => beep('end')).not.toThrow();
});

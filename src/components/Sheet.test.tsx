import { act, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';

type VV = { height: number; offsetTop: number; listeners: Map<string, () => void> };
let vv: VV;
beforeEach(() => {
  vv = { height: 793, offsetTop: 0, listeners: new Map() };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      get height() { return vv.height; },
      get offsetTop() { return vv.offsetTop; },
      addEventListener: (t: string, f: () => void) => vv.listeners.set(t, f),
      removeEventListener: (t: string) => vv.listeners.delete(t),
    },
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 793 });
});
afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

const backdrop = () => screen.getByRole('dialog').parentElement!;

test('キーボードが出たら、シートを見えている範囲（キーボードの上）に合わせる', () => {
  render(<Sheet open title="今日の体重" onClose={() => {}}>中身</Sheet>);
  expect(backdrop().style.height).toBe('');
  vv.height = 450;
  vv.offsetTop = 0;
  act(() => vv.listeners.get('resize')!());
  expect(backdrop().style.top).toBe('0px');
  expect(backdrop().style.height).toBe('450px');
  expect(backdrop().style.bottom).toBe('auto');
});

test('キーボードが閉じたら元に戻す', () => {
  render(<Sheet open title="今日の体重" onClose={() => {}}>中身</Sheet>);
  vv.height = 450;
  act(() => vv.listeners.get('resize')!());
  vv.height = 793;
  act(() => vv.listeners.get('resize')!());
  expect(backdrop().style.height).toBe('');
});

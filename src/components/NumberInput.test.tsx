import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NumberInput } from './NumberInput';

function setup(initial: number | null = null, min = 0, max = 1000) {
  const spy = vi.fn();
  function Host() {
    const [v, setV] = useState<number | null>(initial);
    return <NumberInput value={v} onChange={(x) => { spy(x); setV(x); }} min={min} max={max} inputMode="decimal" aria-label="kg" />;
  }
  render(<Host />);
  return { spy, input: screen.getByLabelText('kg') as HTMLInputElement };
}

test('小数を受け付ける', async () => {
  const { spy, input } = setup();
  await userEvent.type(input, '82.5');
  expect(spy).toHaveBeenLastCalledWith(82.5);
  expect(input).toHaveAttribute('inputmode', 'decimal');
});

test('空にすると null', async () => {
  const { spy, input } = setup(80);
  await userEvent.clear(input);
  expect(spy).toHaveBeenLastCalledWith(null);
});

test('非数・範囲外は onChange せず、blurで元に戻る', async () => {
  const { spy, input } = setup(80);
  await userEvent.clear(input);
  spy.mockClear();
  await userEvent.type(input, 'abc');
  expect(spy).not.toHaveBeenCalled();
  await userEvent.clear(input);
  await userEvent.type(input, '1001');
  expect(spy).not.toHaveBeenCalledWith(1001);
  expect(spy).toHaveBeenLastCalledWith(100);
  await userEvent.tab();
  expect(input.value).toBe('100');
});

test('負の最小値なら負数を受け付ける', async () => {
  const { spy, input } = setup(null, -200, 1000);
  await userEvent.type(input, '-15');
  expect(spy).toHaveBeenLastCalledWith(-15);
});

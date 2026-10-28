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

test('非数は null にして invalid 表示', async () => {
  const { spy, input } = setup(80);
  await userEvent.clear(input);
  await userEvent.type(input, 'abc');
  expect(spy).toHaveBeenLastCalledWith(null);
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('範囲外は途中の値を残さず null（350 を 35 として保存しない）', async () => {
  const { spy, input } = setup(null, 20, 300);
  await userEvent.type(input, '350');
  expect(spy).toHaveBeenLastCalledWith(null);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  await userEvent.tab();
  expect(input.value).toBe('');
});

test('消して短くした値がそのまま値になる（75 → 7）', async () => {
  const { spy, input } = setup(null, 0, 300);
  await userEvent.type(input, '75{Backspace}');
  expect(spy).toHaveBeenLastCalledWith(7);
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

test('負の最小値なら負数を受け付ける', async () => {
  const { spy, input } = setup(null, -200, 1000);
  await userEvent.type(input, '-15');
  expect(spy).toHaveBeenLastCalledWith(-15);
});

test('keepInvalid なら blur しても範囲外の入力を残す', async () => {
  const spy = vi.fn();
  render(<NumberInput value={3} onChange={spy} min={1} max={20} inputMode="numeric" aria-label="n" keepInvalid />);
  const input = screen.getByLabelText('n');
  await userEvent.clear(input);
  await userEvent.type(input, '25');
  await userEvent.tab();
  expect(input).toHaveValue('25');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

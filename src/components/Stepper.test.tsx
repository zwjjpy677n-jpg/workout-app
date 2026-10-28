import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Stepper } from './Stepper';

function setup(initial: number | null, o: { step?: number; min?: number; max?: number } = {}) {
  const spy = vi.fn();
  function Host() {
    const [v, setV] = useState(initial);
    return <Stepper value={v} onChange={(x) => { spy(x); setV(x); }} step={o.step ?? 2.5} min={o.min ?? 0} max={o.max ?? 1000} unit="kg" inputMode="decimal" label="重量" />;
  }
  render(<Host />);
  return { spy, input: screen.getByLabelText('重量') as HTMLInputElement, plus: screen.getByRole('button', { name: '重量を増やす' }), minus: screen.getByRole('button', { name: '重量を減らす' }) };
}

test('＋/− で step ずつ', async () => {
  const { input, plus, minus } = setup(80);
  await userEvent.click(plus);
  expect(input.value).toBe('82.5');
  await userEvent.click(minus);
  await userEvent.click(minus);
  expect(input.value).toBe('77.5');
});

test('null から＋は step、−は min', async () => {
  const a = setup(null);
  await userEvent.click(a.plus);
  expect(a.spy).toHaveBeenLastCalledWith(2.5);
});

test('min/max で止まる', async () => {
  const { spy, minus } = setup(0);
  await userEvent.click(minus);
  expect(spy).toHaveBeenLastCalledWith(0);
});

test('max で止まり、小数の丸め', async () => {
  const a = setup(999, { step: 1, max: 999 });
  await userEvent.click(a.plus);
  expect(a.spy).toHaveBeenLastCalledWith(999);
});

test('1.25 刻みでも誤差が出ない', async () => {
  const { input, plus } = setup(0.1 + 0.2, { step: 1.25 });
  await userEvent.click(plus);
  expect(input.value).toBe('1.55');
});

test('直接入力', async () => {
  const { spy, input } = setup(null);
  await userEvent.type(input, '85');
  expect(spy).toHaveBeenLastCalledWith(85);
  expect(screen.getByText('kg')).toBeInTheDocument();
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { saveSettings } from '../../db/repository';
import { entry, ex, set, wk } from '../../test/factories';
import { PercentSheet } from './PercentSheet';
import { PlateSheet } from './PlateSheet';

beforeEach(resetDb);

test('PlateSheet: 82.5kg は片側 25 + 5 + 1.25', async () => {
  render(<PlateSheet open initialKg={82.5} onClose={() => {}} />);
  expect(await screen.findByText('25 + 5 + 1.25')).toBeInTheDocument();
});

test('PlateSheet: 作れない重量は最も近い軽い重量と差分', async () => {
  render(<PlateSheet open initialKg={60} onClose={() => {}} />);
  const input = await screen.findByLabelText('目標重量');
  await userEvent.clear(input);
  await userEvent.type(input, '61');
  expect(await screen.findByText('最も近い: 60kg（−1kg）')).toBeInTheDocument();
});

test('PlateSheet: 設定のバー重量・プレートを使う', async () => {
  await saveSettings({ barKg: 15, plates: [10] });
  render(<PlateSheet open initialKg={55} onClose={() => {}} />);
  expect(await screen.findByText('10 + 10')).toBeInTheDocument();
});

test('PercentSheet: 自己ベストの推定1RMから%表', async () => {
  const bench = ex('bench');
  const pick = vi.fn();
  render(<PercentSheet open onClose={() => {}} exercise={bench} workouts={[wk(1000, [entry('bench', [set({ weight: 104.5, reps: 1 })])])]} onPickWeight={pick} />);
  expect(screen.getByText('104.5kg')).toBeInTheDocument();
  const row = screen.getByRole('button', { name: /^80%/ });
  expect(within(row).getByText('82.5kg')).toBeInTheDocument();
  await userEvent.click(row);
  expect(pick).toHaveBeenCalledWith(82.5);
});

test('PercentSheet: 記録がなければメッセージ', () => {
  render(<PercentSheet open onClose={() => {}} exercise={ex('bench')} workouts={[]} />);
  expect(screen.getByText('記録がありません')).toBeInTheDocument();
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/db';
import type { Item, Log } from '../../lib/types';
import { HistoryPage } from './HistoryPage';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const item = (id: string): Item => ({
  id, name: `項目${id}`, slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: new Date(2026, 9, 10).getTime(),
});
const log = (date: string, itemId: string): Log => ({ id: `${date}:${itemId}`, date, itemId, done: true });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 30, 8));
  await db.delete();
  await db.open();
  await db.items.bulkAdd([item('a'), item('b'), item('c')]);
  await db.logs.bulkAdd([
    log('2026-10-20', 'a'), log('2026-10-20', 'b'), log('2026-10-20', 'c'),
    log('2026-10-21', 'a'), log('2026-10-21', 'b'),
    log('2026-10-22', 'a'),
  ]);
});
afterEach(() => vi.useRealTimers());

const cell = (name: string) => screen.getByRole('button', { name });

test('達成率で3段階の色。項目を作る前の日は色なし', async () => {
  render(<HistoryPage />);
  expect(await screen.findByRole('heading', { name: '2026年10月' })).toBeInTheDocument();
  await vi.waitFor(() => expect(cell('10月20日')).toHaveAttribute('data-level', '3'));
  expect(cell('10月21日')).toHaveAttribute('data-level', '2');
  expect(cell('10月22日')).toHaveAttribute('data-level', '1');
  expect(cell('10月5日')).not.toHaveAttribute('data-level');
  expect(cell('10月31日')).toBeDisabled();
});

test('前の月に切り替えられる', async () => {
  render(<HistoryPage />);
  await userEvent.click(await screen.findByRole('button', { name: '前の月' }));
  expect(screen.getByRole('heading', { name: '2026年9月' })).toBeInTheDocument();
});

test('日付を押すとその日のルーティンを直せる', async () => {
  render(<HistoryPage />);
  await vi.waitFor(() => expect(cell('10月29日')).toHaveAttribute('data-level', '1'));
  await userEvent.click(cell('10月29日'));
  const sheet = screen.getByRole('dialog', { name: '10月29日（木）' });
  await userEvent.click(await within(sheet).findByRole('checkbox', { name: '項目a' }));
  await userEvent.click(within(sheet).getByRole('checkbox', { name: '項目b' }));
  await vi.waitFor(() => expect(cell('10月29日')).toHaveAttribute('data-level', '2'));
  expect(await db.logs.get('2026-10-29:a')).toMatchObject({ done: true });
});

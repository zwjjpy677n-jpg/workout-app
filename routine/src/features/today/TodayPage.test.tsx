import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/db';
import type { Item } from '../../lib/types';
import { TodayPage } from './TodayPage';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const CREATED = new Date(2026, 9, 1).getTime();
const item = (p: Partial<Item> & { id: string; name: string }): Item => ({
  slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: CREATED, ...p,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 30, 8)); // 金曜
  await db.delete();
  await db.open();
  await db.items.bulkAdd([
    item({ id: 'w', name: '体重をはかる', order: 0 }),
    item({ id: 'h', name: '水を飲む', order: 1, kind: 'number', target: 1500, unit: 'ml', step: 250 }),
    item({ id: 's', name: 'ストレッチ', slot: 'night' }),
    item({ id: 'x', name: '日曜だけ', slot: 'pre', days: [0] }),
  ]);
});
afterEach(() => vi.useRealTimers());

test('今日やる時間帯だけ見出しが出る。曜日が合わない項目は出ない', async () => {
  render(<TodayPage />);
  expect(await screen.findByRole('heading', { name: '朝' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '夜' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '練習前' })).not.toBeInTheDocument();
  expect(screen.queryByText('日曜だけ')).not.toBeInTheDocument();
});

test('上に達成数・達成率・連続日数', async () => {
  render(<TodayPage />);
  const head = await screen.findByTestId('summary');
  expect(await within(head).findByText('0/3')).toBeInTheDocument();
  expect(within(head).getByText('0%')).toBeInTheDocument();
  expect(within(head).getByText('🔥 0日')).toBeInTheDocument();
});

test('チェック項目を押すと数が増える', async () => {
  render(<TodayPage />);
  const row = await screen.findByRole('checkbox', { name: '体重をはかる' });
  await userEvent.click(row);
  expect(await screen.findByText('1/3')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '体重をはかる' })).toHaveAttribute('aria-checked', 'true');
});

test('数値項目は目標まで増やすとチェックが付く', async () => {
  render(<TodayPage />);
  const plus = await screen.findByRole('button', { name: '水を飲むを増やす' });
  for (let i = 0; i < 6; i++) await userEvent.click(plus);
  expect(await screen.findByText('1500 / 1500 ml')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '水を飲む できた' })).toBeInTheDocument();
  expect(screen.getByText('1/3')).toBeInTheDocument();
});

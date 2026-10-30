import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromDateKey } from '../../../../src/lib/dates';
import type { Item, Log } from '../../lib/types';
import { Stats } from './Stats';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const C = fromDateKey('2026-10-28').getTime();
const item = (p: Partial<Item> & { id: string; name: string }): Item => ({
  slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: C, ...p,
});
const ITEMS = [
  item({ id: 'a', name: '体重' }),
  item({ id: 'w', name: '水を飲む', kind: 'number', target: 1500, unit: 'ml' }),
  item({ id: 's', name: '睡眠', kind: 'number', target: 7.5, unit: '時間' }),
  item({ id: 'g', name: '消した', deletedAt: fromDateKey('2026-10-29').getTime() + 3_600_000 }),
  item({ id: 'g2', name: '記録なしで消した', deletedAt: C + 1 }),
];
const l = (date: string, itemId: string, done: boolean, value?: number): Log => ({ id: `${date}:${itemId}`, date, itemId, done, value });
const LOGS = [
  l('2026-10-28', 'a', true), l('2026-10-28', 'w', true, 1500), l('2026-10-28', 's', true, 8), l('2026-10-28', 'g', true),
  l('2026-10-29', 'a', true), l('2026-10-29', 'w', false, 1000), l('2026-10-29', 's', true, 7.5),
  l('2026-10-30', 'a', true),
];
const TODAY = '2026-10-30';

test('今週・今月の達成率と、連続・最長', () => {
  render(<Stats items={ITEMS} logs={LOGS} today={TODAY} />);
  expect(within(screen.getByTestId('week')).getByText('70%')).toBeInTheDocument();
  expect(within(screen.getByTestId('month')).getByText('70%')).toBeInTheDocument();
  expect(within(screen.getByTestId('streak')).getByText('0日')).toBeInTheDocument();
  expect(within(screen.getByTestId('longest')).getByText('1日')).toBeInTheDocument();
});

test('分母0なら —', () => {
  render(<Stats items={[]} logs={[]} today={TODAY} />);
  expect(within(screen.getByTestId('week')).getByText('—')).toBeInTheDocument();
});

test('項目ごとの直近30日。消した項目は記録があれば（削除済み）で残る', () => {
  render(<Stats items={ITEMS} logs={LOGS} today={TODAY} />);
  const list = screen.getByRole('list', { name: '項目ごとの達成率' });
  const row = (name: string) => within(list).getByText(name).closest('li')!;
  expect(within(row('体重')).getByText('100%')).toBeInTheDocument();
  expect(within(row('水を飲む')).getByText('33%')).toBeInTheDocument();
  expect(within(row('睡眠')).getByText('67%')).toBeInTheDocument();
  expect(within(row('消した（削除済み）')).getByText('100%')).toBeInTheDocument();
  expect(within(list).queryByText(/記録なしで消した/)).not.toBeInTheDocument();
});

test('数値の項目を切り替えてグラフを見る。数値の項目がなければグラフの欄は出ない', async () => {
  const { unmount } = render(<Stats items={ITEMS} logs={LOGS} today={TODAY} />);
  expect(screen.getByRole('heading', { name: '水を飲むの推移' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '睡眠' }));
  expect(screen.getByRole('heading', { name: '睡眠の推移' })).toBeInTheDocument();
  unmount();
  render(<Stats items={[ITEMS[0]]} logs={LOGS} today={TODAY} />);
  expect(screen.queryByRole('heading', { name: /の推移$/ })).not.toBeInTheDocument();
});

test('項目ごとの一覧は時間帯の順 → 並び順', () => {
  const xs = [
    item({ id: 'n', name: '夜の項目', slot: 'night' }),
    item({ id: 'm1', name: '朝の2番', order: 1 }),
    item({ id: 'm0', name: '朝の1番', order: 0 }),
  ];
  render(<Stats items={xs} logs={[]} today={TODAY} />);
  const names = within(screen.getByRole('list', { name: '項目ごとの達成率' })).getAllByRole('listitem').map((li) => li.querySelector('span')!.textContent);
  expect(names).toEqual(['朝の1番', '朝の2番', '夜の項目']);
});

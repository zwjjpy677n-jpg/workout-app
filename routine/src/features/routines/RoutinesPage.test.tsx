import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/db';
import type { Item } from '../../lib/types';
import { RoutinesPage } from './RoutinesPage';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const item = (p: Partial<Item> & { id: string; name: string }): Item => ({
  slot: 'morning', days: EVERY, kind: 'check', order: 0, active: true, createdAt: 1, ...p,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.items.bulkAdd([
    item({ id: 'a', name: '体重', order: 0 }),
    item({ id: 'b', name: '水', order: 1 }),
    item({ id: 'p', name: '休んでる', slot: 'night', active: false }),
    item({ id: 'g', name: '消した', slot: 'night', order: 1, deletedAt: 5 }),
  ]);
});

const section = (label: string) => screen.getByRole('region', { name: label });
const names = (label: string) => within(section(label)).getAllByRole('button', { name: /を編集$/ }).map((b) => b.getAttribute('aria-label')!.replace(/を編集$/, ''));

test('時間帯ごとに並び、消した項目は出ず、休止中には印', async () => {
  render(<RoutinesPage />);
  await screen.findByRole('button', { name: '体重を編集' });
  expect(names('朝')).toEqual(['体重', '水']);
  expect(names('夜')).toEqual(['休んでる']);
  expect(within(section('夜')).getByText('休止中')).toBeInTheDocument();
});

test('チェック項目を曜日指定で追加', async () => {
  render(<RoutinesPage />);
  await userEvent.click(await screen.findByRole('button', { name: '項目を追加' }));
  const sheet = screen.getByRole('dialog', { name: '項目を追加' });
  await userEvent.type(within(sheet).getByRole('textbox', { name: '名前' }), '日記');
  await userEvent.click(within(sheet).getByRole('button', { name: '夜' }));
  await userEvent.click(within(sheet).getByRole('button', { name: '曜日を選ぶ' }));
  for (const d of ['日', '火', '木', '金', '土']) await userEvent.click(within(sheet).getByRole('button', { name: d }));
  await userEvent.click(within(sheet).getByRole('button', { name: '保存' }));
  await screen.findByRole('button', { name: '日記を編集' });
  expect(names('夜')).toEqual(['休んでる', '日記']);
  const saved = (await db.items.toArray()).find((x) => x.name === '日記')!;
  expect(saved).toMatchObject({ slot: 'night', days: [1, 3], kind: 'check' });
});

test('数値項目は目標が要る。名前が空・曜日0件でも保存できない', async () => {
  render(<RoutinesPage />);
  await userEvent.click(await screen.findByRole('button', { name: '項目を追加' }));
  const sheet = screen.getByRole('dialog', { name: '項目を追加' });
  const save = within(sheet).getByRole('button', { name: '保存' });
  expect(save).toBeDisabled();
  await userEvent.type(within(sheet).getByRole('textbox', { name: '名前' }), '睡眠');
  expect(save).toBeEnabled();
  await userEvent.click(within(sheet).getByRole('button', { name: '数値' }));
  expect(save).toBeDisabled();
  await userEvent.type(within(sheet).getByRole('textbox', { name: '目標' }), '7.5');
  await userEvent.type(within(sheet).getByRole('textbox', { name: '単位' }), '時間');
  expect(save).toBeEnabled();
  await userEvent.click(within(sheet).getByRole('button', { name: '曜日を選ぶ' }));
  for (const d of ['日', '月', '火', '水', '木', '金', '土']) await userEvent.click(within(sheet).getByRole('button', { name: d }));
  expect(save).toBeDisabled();
  await userEvent.click(within(sheet).getByRole('button', { name: '毎日' }));
  await userEvent.click(save);
  await screen.findByRole('button', { name: '睡眠を編集' });
  expect((await db.items.toArray()).find((x) => x.name === '睡眠')).toMatchObject({ kind: 'number', target: 7.5, unit: '時間', step: 1, days: EVERY });
});

test('名前を変える・休止と再開・削除', async () => {
  render(<RoutinesPage />);
  await userEvent.click(await screen.findByRole('button', { name: '水を編集' }));
  let sheet = screen.getByRole('dialog', { name: '項目を編集' });
  const name = within(sheet).getByRole('textbox', { name: '名前' });
  await userEvent.clear(name);
  await userEvent.type(name, '水分');
  await userEvent.click(within(sheet).getByRole('button', { name: '保存' }));
  await screen.findByRole('button', { name: '水分を編集' });

  await userEvent.click(screen.getByRole('button', { name: '水分を編集' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: '項目を編集' })).getByRole('button', { name: '休止する' }));
  expect(await within(section('朝')).findByText('休止中')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '水分を編集' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: '項目を編集' })).getByRole('button', { name: '再開する' }));
  await vi.waitFor(() => expect(within(section('朝')).queryByText('休止中')).not.toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: '水分を編集' }));
  sheet = screen.getByRole('dialog', { name: '項目を編集' });
  await userEvent.click(within(sheet).getByRole('button', { name: '削除' }));
  await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }));
  await vi.waitFor(() => expect(screen.queryByRole('button', { name: '水分を編集' })).not.toBeInTheDocument());
  expect((await db.items.get('b'))!.deletedAt).toBeGreaterThan(0);
});

test('上へ・下へで同じ時間帯の中の順番が変わる', async () => {
  render(<RoutinesPage />);
  await userEvent.click(await screen.findByRole('button', { name: '水を上へ' }));
  await vi.waitFor(() => expect(names('朝')).toEqual(['水', '体重']));
  await userEvent.click(screen.getByRole('button', { name: '水を下へ' }));
  await vi.waitFor(() => expect(names('朝')).toEqual(['体重', '水']));
});

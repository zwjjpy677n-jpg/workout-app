import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/db';
import { TodoList } from './TodoList';

const TODAY = '2026-10-30';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const todo = (id: string, date: string, text: string, order = 0, done = false) => ({ id, date, text, order, done });

test('追加すると一覧に出て、入力欄が空になる', async () => {
  render(<TodoList today={TODAY} />);
  const input = await screen.findByRole('textbox', { name: 'やることを追加' });
  await userEvent.type(input, '買い物{Enter}');
  expect(await screen.findByRole('checkbox', { name: '買い物' })).toBeInTheDocument();
  expect(input).toHaveValue('');
});

test('押すとできた、もう一度で戻る', async () => {
  await db.todos.add(todo('a', TODAY, '買い物'));
  render(<TodoList today={TODAY} />);
  const box = await screen.findByRole('checkbox', { name: '買い物' });
  await userEvent.click(box);
  expect(await screen.findByRole('checkbox', { name: '買い物', checked: true })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: '買い物' }));
  expect(await screen.findByRole('checkbox', { name: '買い物', checked: false })).toBeInTheDocument();
});

test('メニューから編集・上へ・削除', async () => {
  await db.todos.bulkAdd([todo('a', TODAY, 'A', 0), todo('b', TODAY, 'B', 1)]);
  render(<TodoList today={TODAY} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Bのメニュー' }));
  await userEvent.click(screen.getByRole('button', { name: '上へ' }));
  await screen.findByRole('checkbox', { name: 'B' });
  const names = () => screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'));
  await vi.waitFor(() => expect(names()).toEqual(['B', 'A']));

  await userEvent.click(screen.getByRole('button', { name: 'Aのメニュー' }));
  await userEvent.click(screen.getByRole('button', { name: '編集' }));
  const field = screen.getByRole('textbox', { name: '内容' });
  await userEvent.clear(field);
  await userEvent.type(field, 'A2');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('checkbox', { name: 'A2' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'A2のメニュー' }));
  await userEvent.click(screen.getByRole('button', { name: '削除' }));
  await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'A2' })).not.toBeInTheDocument());
});

test('前の日の未完了を選んで持ち越す', async () => {
  await db.todos.bulkAdd([todo('a', '2026-10-29', '洗濯', 0), todo('b', '2026-10-29', '電話', 1), todo('c', '2026-10-29', '済み', 2, true)]);
  render(<TodoList today={TODAY} />);
  await userEvent.click(await screen.findByRole('button', { name: '未完了が2件あります' }));
  const sheet = screen.getByRole('dialog', { name: '持ち越す' });
  const picks = within(sheet).getAllByRole('checkbox');
  expect(picks).toHaveLength(2);
  picks.forEach((p) => expect(p).toBeChecked());
  await userEvent.click(within(sheet).getByRole('checkbox', { name: /電話/ }));
  await userEvent.click(within(sheet).getByRole('button', { name: '持ち越す' }));
  expect(await screen.findByRole('checkbox', { name: '洗濯' })).toBeInTheDocument();
  expect(screen.getByText('10/29から')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '未完了が1件あります' })).toBeInTheDocument();
});

test('未完了がなければ案内は出ない', async () => {
  await db.todos.add(todo('a', '2026-10-29', '済み', 0, true));
  render(<TodoList today={TODAY} />);
  await screen.findByRole('textbox', { name: 'やることを追加' });
  expect(screen.queryByRole('button', { name: /未完了が/ })).not.toBeInTheDocument();
});

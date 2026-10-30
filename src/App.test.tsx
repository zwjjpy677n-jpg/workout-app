import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { ROUTER_FUTURE } from './test/render';
import { resetDb } from './db/db';
import { startWorkout } from './db/repository';

it('4つのタブを表示し、タップで画面が切り替わる', async () => {
  render(<MemoryRouter initialEntries={['/']} future={ROUTER_FUTURE}><AppRoutes /></MemoryRouter>);
  for (const l of ['ホーム', 'カレンダー', 'グラフ', '管理']) expect(screen.getByRole('link', { name: l })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'カレンダー' }));
  expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute('aria-current', 'page');
});

it('記録画面ではタブを出さない', async () => {
  await resetDb();
  await startWorkout({ name: 'PUSH', exerciseIds: [] });
  render(<MemoryRouter initialEntries={['/workout']} future={ROUTER_FUTURE}><AppRoutes /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: '終了' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'ホーム' })).toBeNull();
});

// iPhone のホーム画面アプリでは、画面に固定したタブバーが短いページで浮いてしまう。
// 中身だけをスクロールさせ、タブバーはその下に並べる
it('タブバーは中身のスクロール領域の外に、下に並べて置く', () => {
  const { container } = render(<MemoryRouter initialEntries={['/calendar']} future={ROUTER_FUTURE}><AppRoutes /></MemoryRouter>);
  const main = container.querySelector('main');
  const nav = container.querySelector('nav');
  expect(main).not.toBeNull();
  expect(main!.contains(nav)).toBe(false);
  expect(main!.nextElementSibling).toBe(nav);
});

it('タブを切り替えると中身は一番上から表示する', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/']} future={ROUTER_FUTURE}><AppRoutes /></MemoryRouter>);
  const main = container.querySelector('main')!;
  main.scrollTop = 500;
  await userEvent.click(screen.getByRole('link', { name: 'カレンダー' }));
  expect(main.scrollTop).toBe(0);
});

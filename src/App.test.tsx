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

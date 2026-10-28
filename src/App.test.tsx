import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

it('4つのタブを表示し、タップで画面が切り替わる', async () => {
  render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);
  for (const l of ['ホーム', 'カレンダー', 'グラフ', '管理']) expect(screen.getByRole('link', { name: l })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'カレンダー' }));
  expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute('aria-current', 'page');
});

it('記録画面ではタブを出さない', () => {
  render(<MemoryRouter initialEntries={['/workout']}><AppRoutes /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'ホーム' })).toBeNull();
});

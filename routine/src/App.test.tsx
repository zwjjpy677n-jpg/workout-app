import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

test('3つのタブがあり、最初は今日の画面', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '今日' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '記録' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ルーティン' })).toBeInTheDocument();
});

test('記録タブを押すと記録の画面', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  await userEvent.click(screen.getByRole('link', { name: '記録' }));
  expect(screen.getByRole('heading', { name: '記録' })).toBeInTheDocument();
});

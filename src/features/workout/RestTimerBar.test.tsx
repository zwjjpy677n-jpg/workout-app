import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestTimerBar } from './RestTimerBar';

const base = { remaining: 0, total: 90, running: false, finished: true, start: vi.fn(), add: vi.fn(), skip: vi.fn(), dismiss: vi.fn() };

test('レスト終了を画面で知らせ、閉じられる', async () => {
  render(<RestTimerBar timer={base} />);
  expect(screen.getByRole('alert')).toHaveTextContent('レスト終了 ・ 次のセットへ');
  await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
  expect(base.dismiss).toHaveBeenCalled();
});

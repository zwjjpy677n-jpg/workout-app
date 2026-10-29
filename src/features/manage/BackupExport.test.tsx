import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { ensureSeeded } from '../../db/seed';
import { toDateKey } from '../../lib/dates';
import { BackupPanel } from './BackupPanel';

const { saveFile } = vi.hoisted(() => ({ saveFile: vi.fn() }));
vi.mock('../../lib/device', async (orig) => ({ ...(await orig<typeof import('../../lib/device')>()), saveFile }));

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
  saveFile.mockReset();
});

const exportIt = () => userEvent.click(screen.getByRole('button', { name: /エクスポート/ }));

test('書き出すと grind-日付.json の名前で保存し、知らせる', async () => {
  saveFile.mockResolvedValue('saved');
  render(<BackupPanel />);
  await exportIt();
  expect(await screen.findByText('エクスポートしました')).toBeInTheDocument();
  expect(saveFile.mock.calls[0][0]).toBe(`grind-${toDateKey(Date.now())}.json`);
  expect(JSON.parse(saveFile.mock.calls[0][1] as string).app).toBe('ironlog');
});

test('共有画面をキャンセルしたら何も出さない、失敗したら「書き出せませんでした」', async () => {
  saveFile.mockResolvedValueOnce('cancelled');
  render(<BackupPanel />);
  await exportIt();
  await new Promise((r) => setTimeout(r, 30));
  expect(screen.queryByText('エクスポートしました')).toBeNull();
  saveFile.mockRejectedValueOnce(new Error('disk'));
  await exportIt();
  expect(await screen.findByText('書き出せませんでした')).toBeInTheDocument();
});

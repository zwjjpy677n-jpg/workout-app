import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getSettings, listExercises, listRoutines, setBodyweight, startWorkout } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { ManagePage } from './ManagePage';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

const tab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));

test('種目を追加すると部位の一覧に出る', async () => {
  render(<ManagePage />);
  await screen.findByText('ベンチプレス');
  await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }));
  const dlg = screen.getByRole('dialog', { name: '種目を追加' });
  await userEvent.type(within(dlg).getByLabelText('名前'), 'ブルガリアンスクワット');
  await userEvent.selectOptions(within(dlg).getByLabelText('部位'), 'legs');
  await userEvent.selectOptions(within(dlg).getByLabelText('タイプ'), 'weight');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  const legs = await screen.findByRole('region', { name: '脚' });
  expect(await within(legs).findByText('ブルガリアンスクワット')).toBeInTheDocument();
});

test('記録で使用中の種目を削除するとアーカイブされる', async () => {
  const bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!;
  await startWorkout({ name: 'P', exerciseIds: [bench.id] });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ManagePage />);
  await userEvent.click(await screen.findByText('ベンチプレス'));
  const dlg = screen.getByRole('dialog', { name: '種目を編集' });
  expect(within(dlg).getByLabelText('タイプ')).toBeDisabled();
  await userEvent.click(within(dlg).getByRole('button', { name: '削除' }));
  await waitFor(() => expect(screen.queryByText('ベンチプレス')).toBeNull());
  expect((await listExercises({ includeArchived: true })).find((e) => e.id === bench.id)?.archived).toBe(true);
});

test('ルーティンを作成できる', async () => {
  render(<ManagePage />);
  await tab('ルーティン');
  await userEvent.click(screen.getByRole('button', { name: '＋ ルーティンを追加' }));
  const dlg = screen.getByRole('dialog', { name: 'ルーティンを追加' });
  await userEvent.type(within(dlg).getByLabelText('ルーティン名'), 'PUSH');
  await userEvent.click(await within(dlg).findByRole('checkbox', { name: 'ベンチプレス' }));
  await userEvent.click(within(dlg).getByRole('checkbox', { name: 'ディップス' }));
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(await screen.findByText('2種目')).toBeInTheDocument();
  const [r] = await listRoutines();
  expect(r.name).toBe('PUSH');
  expect(r.exerciseIds).toHaveLength(2);
});

test('体重履歴を表示・削除', async () => {
  await setBodyweight('2026-10-28', 71.2);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ManagePage />);
  await tab('体重');
  await userEvent.click(await screen.findByText('71.2kg'));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '削除' }));
  await waitFor(() => expect(screen.queryByText('71.2kg')).toBeNull());
});

test('設定でプレートをオフにすると保存される', async () => {
  render(<ManagePage />);
  await tab('設定');
  await userEvent.click(await screen.findByRole('checkbox', { name: '1.25kg' }));
  await waitFor(async () => expect((await getSettings()).plates).not.toContain(1.25));
});

test('不正なJSONのインポートはエラー表示し、データは変わらない', async () => {
  render(<ManagePage />);
  await tab('バックアップ');
  await userEvent.upload(screen.getByLabelText('インポート'), new File(['{bad'], 'x.json', { type: 'application/json' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('バックアップファイルの形式が正しくありません');
  expect(await listExercises()).toHaveLength(14);
});

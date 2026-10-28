import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getProgram, getSettings, listExercises, listRoutines, saveRoutine, setBodyweight, startWorkout } from '../../db/repository';
import { defaultItem } from '../../lib/types';
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
  expect(r.items).toHaveLength(2);
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

test('種目のバー重量を保存・空欄でnull', async () => {
  render(<ManagePage />);
  await userEvent.click(await screen.findByText('デッドリフト'));
  let dlg = screen.getByRole('dialog', { name: '種目を編集' });
  const bar = within(dlg).getByLabelText('バー重量');
  expect(bar).toHaveValue('20');
  await userEvent.clear(bar);
  await userEvent.type(bar, '25');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  await waitFor(async () => expect((await listExercises()).find((e) => e.name === 'デッドリフト')?.barKg).toBe(25));
  await userEvent.click(await screen.findByText('デッドリフト'));
  dlg = screen.getByRole('dialog', { name: '種目を編集' });
  await userEvent.clear(within(dlg).getByLabelText('バー重量'));
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  await waitFor(async () => expect((await listExercises()).find((e) => e.name === 'デッドリフト')?.barKg).toBeNull());
});

test('ルーティンの曜日と目標を編集できる', async () => {
  const bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!;
  await saveRoutine({ name: 'PUSH', weekday: null, items: [defaultItem(bench.id)] });
  render(<ManagePage />);
  await tab('ルーティン');
  expect(await screen.findByText('1種目')).toBeInTheDocument();
  await userEvent.click(screen.getByText('PUSH'));
  const dlg = screen.getByRole('dialog', { name: 'ルーティンを編集' });
  await userEvent.selectOptions(within(dlg).getByLabelText('曜日'), '2');
  const sets = within(dlg).getByLabelText('ベンチプレス セット数');
  await userEvent.clear(sets);
  await userEvent.type(sets, '5');
  const reps = within(dlg).getByLabelText('ベンチプレス 回数');
  await userEvent.clear(reps);
  await userEvent.type(reps, '3〜5');
  await userEvent.click(within(dlg).getByLabelText('ベンチプレス メイン'));
  const inc = within(dlg).getByLabelText('ベンチプレス 上げ幅');
  await userEvent.clear(inc);
  await userEvent.type(inc, '1.25');
  await userEvent.type(within(dlg).getByLabelText('ベンチプレス メモ'), '止めて押す');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(await screen.findByText('火曜 ・ 1種目')).toBeInTheDocument();
  expect((await listRoutines())[0]).toMatchObject({ weekday: 2, items: [{ exerciseId: bench.id, sets: 5, reps: '3〜5', main: true, inc: 1.25, note: '止めて押す' }] });
});

test('参考メニューを読み込む', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ManagePage />);
  await tab('ルーティン');
  await userEvent.click(await screen.findByRole('button', { name: '参考メニューを読み込む' }));
  await waitFor(async () => expect(await listRoutines()).toHaveLength(4));
  expect(await screen.findByText('月曜 ・ 8種目')).toBeInTheDocument();
});

describe('プログラム', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 10));
  });
  afterEach(() => vi.useRealTimers());

  test('開始日を決めて始め、終了できる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ManagePage />);
    await tab('プログラム');
    const date = await screen.findByLabelText('開始日');
    expect(date).toHaveValue('2026-10-28');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-26');
    await userEvent.click(screen.getByRole('button', { name: 'この日から始める' }));
    expect(await screen.findByText('今 1週目')).toBeInTheDocument();
    expect(screen.getByText('開始日 2026/10/26')).toBeInTheDocument();
    expect((await getProgram())?.startDate).toBe('2026-10-26');
    await userEvent.click(screen.getByRole('button', { name: 'プログラムを終了' }));
    await waitFor(async () => expect(await getProgram()).toBeNull());
    expect(await screen.findByRole('button', { name: 'この日から始める' })).toBeInTheDocument();
  });

  test('次の8週間を始めると今日からになりテストはリセット', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { saveProgram } = await import('../../db/repository');
    await saveProgram({ startDate: '2026-08-01', tests: { start: { date: '2026-08-01', bodyweight: 70, lifts: {} }, end: null } });
    render(<ManagePage />);
    await tab('プログラム');
    expect(await screen.findByText('8週間完了')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '次の8週間を始める' }));
    await waitFor(async () => expect(await getProgram()).toEqual({ startDate: '2026-10-28', tests: { start: null, end: null } }));
  });
});

test('ルーティンの範囲外のセット数は保存せずに知らせる', async () => {
  const bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!;
  await saveRoutine({ name: 'PUSH', weekday: null, items: [defaultItem(bench.id)] });
  render(<ManagePage />);
  await tab('ルーティン');
  await userEvent.click(await screen.findByText('PUSH'));
  const dlg = screen.getByRole('dialog', { name: 'ルーティンを編集' });
  expect(within(dlg).getAllByText('セット（1〜20）')[0]).toBeInTheDocument();
  const sets = within(dlg).getByLabelText('ベンチプレス セット数');
  await userEvent.clear(sets);
  await userEvent.type(sets, '25');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(within(dlg).getByText('ベンチプレスのセット数は1〜20、上げ幅は0.5〜20kgで入力してください')).toBeInTheDocument();
  expect((await listRoutines())[0].items[0].sets).toBe(3);
});

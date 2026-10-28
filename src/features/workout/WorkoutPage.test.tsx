import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getActiveWorkout, listExercises, listWorkouts, saveWorkout, startWorkout } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { WorkoutPage } from './WorkoutPage';

let benchId = '';
let activeId = '';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
  benchId = (await listExercises()).find((e) => e.name === 'ベンチプレス')!.id;
  await saveWorkout(wk(new Date(2026, 9, 23, 18), [entry(benchId, [set({ weight: 40, reps: 10, warmup: true }), set({ weight: 80, reps: 8, rpe: 8 }), set({ weight: 80, reps: 7 })])]));
  const active = wk(new Date(2026, 9, 27, 18), [entry(benchId, [{ ...set(), done: false }])], { endedAt: null, name: 'PUSH' });
  activeId = active.id;
  await saveWorkout(active);
});

const rows = async () => {
  const card = await screen.findByRole('region', { name: 'ベンチプレス' });
  return within(card).getAllByRole('row').slice(1);
};

test('前回のトップセットと、行ごとの前回値・プレースホルダーを表示', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  expect(await screen.findByText('前回 10/23 ・ 80kg × 8 @RPE8')).toBeInTheDocument();
  const [r1] = await rows();
  expect(within(r1).getByText('80×8')).toBeInTheDocument();
  expect(within(r1).getByLabelText('重量')).toHaveAttribute('placeholder', '80');
  expect(within(r1).getByLabelText('回数')).toHaveAttribute('placeholder', '8');
});

test('セット追加で2行目の前回が出て、ウォームアップ切替で番号が繰り上がる', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: '＋ セット追加' }));
  let [r1, r2] = await rows();
  expect(within(r2).getByText('80×7')).toBeInTheDocument();
  await userEvent.click(within(r1).getByRole('button', { name: '1' }));
  [r1, r2] = await rows();
  expect(within(r1).getByRole('button', { name: 'W' })).toBeInTheDocument();
  expect(within(r2).getByRole('button', { name: '1' })).toBeInTheDocument();
  expect(within(r2).getByText('80×8')).toBeInTheDocument();
});

test('完了チェックで空欄は前回値で埋まり保存される', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  await userEvent.type(within(r1).getByLabelText('回数'), '9');
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  await waitFor(async () => {
    const w = (await listWorkouts()).find((x) => x.id === activeId)!;
    expect(w.entries[0].sets[0]).toMatchObject({ weight: 80, reps: 9, done: true });
  });
});

test('種目を追加できる', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }));
  const dlg = screen.getByRole('dialog', { name: '種目を追加' });
  await userEvent.click(within(dlg).getByRole('button', { name: '脚' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'スクワット' }));
  expect(await screen.findByRole('region', { name: 'スクワット' })).toBeInTheDocument();
});

test('終了するとendedAtが入りカレンダーへ', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  await userEvent.click(screen.getByRole('button', { name: '終了' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-27');
  expect((await listWorkouts()).find((x) => x.id === activeId)?.endedAt).not.toBeNull();
});

test('完了セットなしで終了すると破棄確認して削除', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: '終了' }));
  expect(await screen.findByTestId('location')).toHaveTextContent(/^\/$/);
  expect((await listWorkouts()).some((x) => x.id === activeId)).toBe(false);
});

test('進行中がなければホームへ', async () => {
  await resetDb();
  renderRoute('/workout', '/workout', <WorkoutPage />);
  expect(await screen.findByTestId('location')).toHaveTextContent(/^\/$/);
});

const fill = async (row: HTMLElement, kg: string, reps: string) => {
  await userEvent.type(within(row).getByLabelText('重量'), kg);
  await userEvent.type(within(row).getByLabelText('回数'), reps);
};

test('完了チェックで種目のレスト秒数からレストタイマーが始まる', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  expect(screen.queryByText('REST')).toBeNull();
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  expect(await screen.findByText('REST')).toBeInTheDocument();
  expect(screen.getByText('03:00')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+15s' }));
  expect(screen.getByText('03:15')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'スキップ' }));
  expect(screen.queryByText('REST')).toBeNull();
});

test('開始直後はコンディション入力が開き、選択が保存される', async () => {
  await resetDb();
  await ensureSeeded();
  await startWorkout({ name: 'X', exerciseIds: [] });
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const dlg = await screen.findByRole('dialog', { name: 'コンディション' });
  await userEvent.click(within(within(dlg).getByRole('group', { name: '睡眠' })).getByRole('button', { name: '4' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'OK' }));
  expect(screen.queryByRole('dialog', { name: 'コンディション' })).toBeNull();
  await waitFor(async () => expect((await getActiveWorkout())?.condition.sleep).toBe(4));
});

test('コンディションはスキップできる', async () => {
  await resetDb();
  await startWorkout({ name: 'X', exerciseIds: [] });
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const dlg = await screen.findByRole('dialog', { name: 'コンディション' });
  await userEvent.click(within(dlg).getByRole('button', { name: 'スキップ' }));
  expect(screen.queryByRole('dialog', { name: 'コンディション' })).toBeNull();
});

test('開始から時間が経っていればコンディションは自動で開かない', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  expect(screen.queryByRole('dialog', { name: 'コンディション' })).toBeNull();
});

test('ワークアウトメモを保存できる', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: 'ワークアウトメモ' }));
  await userEvent.type(screen.getByLabelText('ワークアウトのメモ'), '肩に違和感');
  await waitFor(async () => expect((await getActiveWorkout())?.note).toBe('肩に違和感'));
});

test('過去最高を超えるとPRバッジ', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  await fill(r1, '82.5', '8');
  expect(screen.queryByText('PR')).toBeNull();
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  expect(await screen.findByText('PR')).toBeInTheDocument();
});

test('メニューからプレート計算', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  await fill(r1, '82.5', '8');
  await userEvent.click(screen.getByRole('button', { name: 'メニュー' }));
  await userEvent.click(screen.getByRole('button', { name: 'プレート計算' }));
  expect(await screen.findByText('25 + 5 + 1.25')).toBeInTheDocument();
});

test('過去編集モードではレストもコンディションも出ない', async () => {
  const past = (await listWorkouts()).find((w) => w.endedAt !== null)!;
  renderRoute(`/workout/${past.id}`, '/workout/:id', <WorkoutPage />);
  const [r1] = await rows();
  expect(screen.getByText('EDIT')).toBeInTheDocument();
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  expect(screen.queryByText('REST')).toBeNull();
  expect(screen.queryByRole('dialog', { name: 'コンディション' })).toBeNull();
});

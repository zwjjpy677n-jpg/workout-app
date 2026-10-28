import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getActiveWorkout, listBodyweights, listExercises, saveRoutine, saveWorkout, setBodyweight, startWorkout } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { HomePage } from './HomePage';

let bench = '';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 10));
  await resetDb();
  await ensureSeeded();
  bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!.id;
});
afterEach(() => vi.useRealTimers());

const home = () => renderRoute('/', '/', <HomePage />);

test('START WORKOUT で進行中ワークアウトを作り記録画面へ', async () => {
  home();
  await userEvent.click(await screen.findByRole('button', { name: 'START WORKOUT' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/workout');
  expect(await getActiveWorkout()).toBeDefined();
});

test('進行中があれば RESUME WORKOUT', async () => {
  await startWorkout({ name: 'X', exerciseIds: [] });
  home();
  expect(await screen.findByRole('button', { name: 'RESUME WORKOUT' })).toBeInTheDocument();
});

test('ルーティンから開始するとその種目入り', async () => {
  await saveRoutine({ name: 'PUSH', exerciseIds: [bench] });
  home();
  await userEvent.click(await screen.findByRole('button', { name: /PUSH/ }));
  await screen.findByTestId('location');
  const w = await getActiveWorkout();
  expect(w?.name).toBe('PUSH');
  expect(w?.entries.map((e) => e.exerciseId)).toEqual([bench]);
});

test('今週の日数・ボリューム・部位別セット数・最近の記録', async () => {
  await saveWorkout(wk(new Date(2026, 9, 26, 18), [entry(bench, [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })])], { name: 'PUSH' }));
  await saveWorkout(wk(new Date(2026, 9, 27, 18), [entry(bench, [set({ weight: 50, reps: 10 })])]));
  await saveWorkout(wk(new Date(2026, 9, 20, 18), [entry(bench, [set({ weight: 50, reps: 10 })])]));
  await saveWorkout(wk(new Date(2026, 9, 19, 18), [entry(bench, [set({ weight: 50, reps: 10 })])]));
  home();
  await waitFor(() => expect(screen.getByText('トレーニング日数').parentElement).toHaveTextContent('2日'));
  expect(screen.getByText('総ボリューム').parentElement).toHaveTextContent('1.5t');
  const bars = screen.getByRole('region', { name: '部位別セット数' });
  expect(within(bars).getByText('胸').parentElement).toHaveTextContent('3');
  const recent = screen.getByRole('region', { name: '最近のワークアウト' });
  expect(within(recent).getAllByRole('button')).toHaveLength(3);
  await userEvent.click(within(recent).getByText('10/26 MON'));
  expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-26');
});

test('体重を記録すると値と前回比を表示', async () => {
  await setBodyweight('2026-10-27', 70);
  home();
  await userEvent.click(await screen.findByRole('button', { name: '体重を記録' }));
  await userEvent.type(screen.getByLabelText('体重(kg)'), '71.2');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('71.2')).toBeInTheDocument();
  expect(screen.getByText('+1.2')).toBeInTheDocument();
  expect(await listBodyweights()).toContainEqual({ date: '2026-10-28', kg: 71.2 });
});

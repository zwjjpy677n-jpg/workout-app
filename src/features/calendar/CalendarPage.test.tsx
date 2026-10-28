import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { listExercises, listWorkouts, saveWorkout, setBodyweight } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { CalendarPage } from './CalendarPage';
import { summarizeSets } from './summarizeSets';

let ids: Record<string, string> = {};
let w22 = '';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 10));
  await resetDb();
  await ensureSeeded();
  ids = Object.fromEntries((await listExercises()).map((e) => [e.name, e.id]));
  const b = ids['ベンチプレス'];
  await saveWorkout(wk(new Date(2026, 9, 3, 18), [entry(b, [set({ weight: 120, reps: 10 }), set({ weight: 120, reps: 10 }), set({ weight: 120, reps: 10 }), set({ weight: 120, reps: 10 }), set({ weight: 80, reps: 9 })])]));
  const x = wk(new Date(2026, 9, 22, 18), [entry(b, [set({ weight: 40, reps: 10, warmup: true }), set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 7 })])], {
    name: 'PUSH', note: '調子良い', condition: { sleep: 4, fatigue: null, motivation: 5 },
  });
  w22 = x.id;
  await saveWorkout(x);
  await saveWorkout(wk(new Date(2026, 9, 25, 9), [entry(ids['プランク'], [set({ durationSec: 60 })])]));
  await setBodyweight('2026-10-22', 71.2);
});
afterEach(() => vi.useRealTimers());

const cell = (label: string) => screen.getByRole('button', { name: label });

test('summarizeSets', () => {
  expect(summarizeSets('weight', [set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 8 }), set({ weight: 85, reps: 5 }), set({ weight: 99, reps: 1, done: false })])).toBe('80kg × 8 / 8 / 85kg × 5');
  expect(summarizeSets('bodyweight', [set({ weight: 10, reps: 12 }), set({ weight: 10, reps: 10 })])).toBe('自重+10kg × 12 / 10');
  expect(summarizeSets('time', [set({ durationSec: 60 }), set({ durationSec: 45 })])).toBe('1:00 / 0:45');
});

test('月の合計とボリュームに応じた濃さ', async () => {
  renderRoute('/calendar', '/calendar', <CalendarPage />);
  expect(await screen.findByText('OCT 2026')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('トレーニング日数').parentElement).toHaveTextContent('3日'));
  expect(screen.getByText('総ボリューム').parentElement).toHaveTextContent('7.4t');
  expect(cell('10月3日')).toHaveAttribute('data-level', '3');
  expect(cell('10月22日')).toHaveAttribute('data-level', '1');
  expect(cell('10月25日')).toHaveAttribute('data-level', '1');
  expect(cell('10月4日')).not.toHaveAttribute('data-level');
});

test('日付タップで詳細（ワーキングのみ・体重・コンディション・メモ）', async () => {
  renderRoute('/calendar', '/calendar', <CalendarPage />);
  await userEvent.click(await screen.findByRole('button', { name: '10月22日' }));
  const d = await screen.findByRole('region', { name: '10/22 THU' });
  expect(within(d).getByText('ベンチプレス')).toBeInTheDocument();
  expect(within(d).getByText('80kg × 8 / 8 / 7')).toBeInTheDocument();
  expect(within(d).getByText('体重 71.2kg')).toBeInTheDocument();
  expect(within(d).getByText('睡眠 4 ・ やる気 5')).toBeInTheDocument();
  expect(within(d).getByText('調子良い')).toBeInTheDocument();
});

test('?date= でその月・その日を開く、月移動と今日', async () => {
  renderRoute('/calendar?date=2026-09-15', '/calendar', <CalendarPage />);
  expect(await screen.findByText('SEP 2026')).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: '9/15 TUE' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '次の月' }));
  expect(screen.getByText('OCT 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '前の月' }));
  await userEvent.click(screen.getByRole('button', { name: '前の月' }));
  expect(screen.getByText('AUG 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '今日' }));
  expect(screen.getByText('OCT 2026')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '10/28 WED' })).toBeInTheDocument();
});

test('削除と編集', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderRoute('/calendar?date=2026-10-22', '/calendar', <CalendarPage />);
  const d = await screen.findByRole('region', { name: '10/22 THU' });
  await userEvent.click(await within(d).findByRole('button', { name: '削除' }));
  await waitFor(async () => expect((await listWorkouts()).some((w) => w.id === w22)).toBe(false));
  await userEvent.click(screen.getByRole('button', { name: '10月3日' }));
  const d3 = await screen.findByRole('region', { name: '10/3 SAT' });
  await userEvent.click(within(d3).getByRole('button', { name: '編集' }));
  expect(await screen.findByTestId('location')).toHaveTextContent(/^\/workout\/w\d+$/);
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { listExercises, saveWorkout, setBodyweight } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { ProgressPage } from './ProgressPage';

let ids: Record<string, string> = {};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 10));
  await resetDb();
  await ensureSeeded();
  ids = Object.fromEntries((await listExercises()).map((e) => [e.name, e.id]));
  const b = ids['ベンチプレス'];
  await saveWorkout(wk(new Date(2026, 5, 1), [entry(b, [set({ weight: 90, reps: 1 })])]));
  await saveWorkout(wk(new Date(2026, 7, 10), [entry(b, [set({ weight: 98, reps: 1 })])]));
  await saveWorkout(wk(new Date(2026, 8, 20), [entry(b, [set({ weight: 100, reps: 1 })])]));
  await saveWorkout(wk(new Date(2026, 9, 25), [entry(b, [set({ weight: 104.5, reps: 1 })])]));
  await saveWorkout(wk(new Date(2026, 9, 26), [entry(ids['スクワット'], [set({ weight: 120, reps: 5 })])]));
  await saveWorkout(wk(new Date(2026, 9, 27), [entry(ids['懸垂'], [set({ weight: 10, reps: 8 })])]));
  await setBodyweight('2026-10-27', 71);
});
afterEach(() => vi.useRealTimers());

const page = () => renderRoute('/progress', '/progress', <ProgressPage />);

test('対象は記録のある種目と体重だけ', async () => {
  page();
  const sel = await screen.findByLabelText('対象');
  await waitFor(() => expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual(['ベンチプレス', '懸垂', 'スクワット', '体重']));
});

test('ベンチ・3M・推定1RMの現在値と増減', async () => {
  page();
  await userEvent.selectOptions(await screen.findByLabelText('対象'), ids['ベンチプレス']);
  expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute('aria-pressed', 'true');
  expect(await screen.findByText('104.5')).toBeInTheDocument();
  expect(screen.getByText('▲ 6.5kg')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ALL' }));
  expect(screen.getByText('▲ 14.5kg')).toBeInTheDocument();
  expect(screen.getByText('自己ベスト').parentElement).toHaveTextContent('104.5kg × 1');
});

test('指標ボタンは種目タイプで変わる', async () => {
  page();
  const sel = await screen.findByLabelText('対象');
  await waitFor(() => expect(within(sel).getAllByRole('option')).toHaveLength(4));
  await userEvent.selectOptions(sel, ids['懸垂']);
  expect(screen.getByRole('button', { name: '最大加重' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '総回数' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '推定1RM' })).toBeNull();
});

test('記録1件ならグラフの代わりにメッセージ', async () => {
  page();
  const sel = await screen.findByLabelText('対象');
  await waitFor(() => expect(within(sel).getAllByRole('option')).toHaveLength(4));
  await userEvent.selectOptions(sel, ids['スクワット']);
  expect(screen.getByText('記録が増えるとグラフが表示されます')).toBeInTheDocument();
});

test('%1RM表の行タップでプレート計算', async () => {
  page();
  await userEvent.selectOptions(await screen.findByLabelText('対象'), ids['ベンチプレス']);
  const row = await screen.findByRole('button', { name: /^80%/ });
  expect(within(row).getByText('82.5kg')).toBeInTheDocument();
  await userEvent.click(row);
  expect(await screen.findByRole('dialog', { name: 'プレート計算' })).toBeInTheDocument();
  expect(await screen.findByText('25 + 5 + 1.25')).toBeInTheDocument();
});

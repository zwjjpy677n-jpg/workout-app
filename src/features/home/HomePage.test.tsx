import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getActiveWorkout, listBodyweights, listExercises, listRoutines, saveProgram, saveRoutine, saveWorkout, setBodyweight, startRoutineWorkout, startWorkout } from '../../db/repository';
import { ensureMenuSeeded } from '../../db/menuSeed';
import { ensureSeeded } from '../../db/seed';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { defaultItem } from '../../lib/types';
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

test('自由に記録する で進行中ワークアウトを作り記録画面へ', async () => {
  home();
  await userEvent.click(await screen.findByRole('button', { name: '自由に記録する' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/workout');
  expect((await getActiveWorkout())?.routineId).toBeNull();
});

test('進行中があれば RESUME WORKOUT', async () => {
  await startWorkout({ name: 'X', exerciseIds: [] });
  home();
  expect(await screen.findByRole('button', { name: 'RESUME WORKOUT' })).toBeInTheDocument();
});

test('ルーティンから開始するとその種目入り', async () => {
  await saveRoutine({ name: 'PUSH', weekday: null, items: [defaultItem(bench)] });
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

describe('今日のトレーニング', () => {
  beforeEach(async () => {
    await ensureMenuSeeded();
  });

  const today = () => screen.findByRole('region', { name: '今日のトレーニング' });

  test('曜日のメニューを表示し、始めると記録画面へ', async () => {
    home();
    const card = await today();
    expect(within(card).getByText('脚・瞬発')).toBeInTheDocument();
    expect(within(card).getByText('8種目 ・ 24セット')).toBeInTheDocument();
    expect(within(card).getByText('進捗 0 / 8')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'トレーニングを始める' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/workout');
    const w = await getActiveWorkout();
    const r = (await listRoutines()).find((x) => x.name === '脚・瞬発')!;
    expect(w).toMatchObject({ name: '脚・瞬発', routineId: r.id });
  });

  test('進行中なら進捗と「続きを記録する」', async () => {
    const r = (await listRoutines()).find((x) => x.name === '脚・瞬発')!;
    const w = await startRoutineWorkout(r.id);
    w.entries[0].sets = w.entries[0].sets.map((x) => ({ ...x, weight: 40, reps: 3, done: true }));
    await saveWorkout(w);
    home();
    const card = await today();
    expect(await within(card).findByText('進捗 1 / 8')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '続きを記録する' })).toBeInTheDocument();
  });

  test('種目を足して記録しても進捗は総数を超えない', async () => {
    const r = (await listRoutines()).find((x) => x.name === '脚・瞬発')!;
    const w = await startRoutineWorkout(r.id);
    const done = { weight: 40, reps: 3, durationSec: 20, done: true };
    w.entries[0].sets = w.entries[0].sets.map((x) => ({ ...x, ...done }));
    w.entries.push({ exerciseId: bench, sets: [set({ weight: 60, reps: 5 })] }, { exerciseId: bench, sets: [set({ weight: 60, reps: 5 })] });
    await saveWorkout(w);
    home();
    expect(await within(await today()).findByText('進捗 3 / 10')).toBeInTheDocument();
  });

  test('回復週はセット数を半分で表示', async () => {
    await saveProgram({ startDate: '2026-10-07', tests: { start: null, end: null } });
    home();
    expect(await within(await today()).findByText('8種目 ・ 16セット')).toBeInTheDocument();
  });

  test('今日完了済みなら「記録を見直す」でカレンダーへ', async () => {
    const r = (await listRoutines()).find((x) => x.name === '脚・瞬発')!;
    await saveWorkout(wk(new Date(2026, 9, 28, 7), [entry(bench, [set({ weight: 50, reps: 5 })])], { routineId: r.id, name: r.name }));
    home();
    await userEvent.click(within(await today()).getByRole('button', { name: '記録を見直す' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-28');
  });

  test('予定のない日は休みと次の予定', async () => {
    vi.setSystemTime(new Date(2026, 9, 29, 10));
    home();
    const card = await screen.findByRole('region', { name: '今日は休み' });
    expect(within(card).getByText('次は金曜 上半身・瞬発')).toBeInTheDocument();
  });

  test('日曜のルーティンも出る', async () => {
    vi.setSystemTime(new Date(2026, 10, 1, 10));
    await saveRoutine({ name: '日曜練', weekday: 0, items: [] });
    home();
    expect(within(await today()).getByText('日曜練')).toBeInTheDocument();
  });

  test('別のワークアウトが進行中なら RESUME を優先', async () => {
    await startWorkout({ name: 'X', exerciseIds: [] });
    home();
    expect(await screen.findByRole('button', { name: 'RESUME WORKOUT' })).toBeInTheDocument();
    expect(within(await today()).queryByRole('button', { name: 'トレーニングを始める' })).toBeNull();
  });
});

describe('週ヘッダー', () => {
  test('プログラム4週目は回復週', async () => {
    await saveProgram({ startDate: '2026-10-07', tests: { start: null, end: null } });
    home();
    const h = await screen.findByRole('region', { name: 'プログラム' });
    expect(within(h).getByText('4')).toBeInTheDocument();
    expect(within(h).getByText('週目 / 8')).toBeInTheDocument();
    expect(within(h).getByText('回復週：重さはそのまま、セット数を半分に')).toBeInTheDocument();
    const bars = h.querySelectorAll('[data-state]');
    expect(bars).toHaveLength(8);
    expect(bars[3]).toHaveAttribute('data-state', 'now');
    expect(bars[3]).toHaveAttribute('data-deload');
    expect(bars[0]).toHaveAttribute('data-state', 'done');
    expect(bars[5]).toHaveAttribute('data-state', 'future');
  });

  test('プログラムなしでは出ない', async () => {
    home();
    await screen.findByText('トレーニング日数');
    expect(screen.queryByRole('region', { name: 'プログラム' })).toBeNull();
  });
});

describe('記録中にルーティンをタップ', () => {
  test('確認を出し、キャンセルならホームに留まる', async () => {
    await saveRoutine({ name: 'PUSH', weekday: null, items: [defaultItem(bench)] });
    await startWorkout({ name: '自由', exerciseIds: [] });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    home();
    await userEvent.click(await screen.findByRole('button', { name: /PUSH/ }));
    expect(confirm).toHaveBeenCalledWith('記録中のワークアウト「自由」があります。先にそちらを終了してください。記録中のワークアウトを開きますか？');
    expect(screen.queryByTestId('location')).toBeNull();
    expect((await getActiveWorkout())?.name).toBe('自由');
  });

  test('OKなら記録中のワークアウトを開く', async () => {
    await saveRoutine({ name: 'PUSH', weekday: null, items: [defaultItem(bench)] });
    await startWorkout({ name: '自由', exerciseIds: [] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    home();
    await userEvent.click(await screen.findByRole('button', { name: /PUSH/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/workout');
    expect((await getActiveWorkout())?.name).toBe('自由');
  });
});

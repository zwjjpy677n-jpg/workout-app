import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getActiveWorkout, getWorkout, listExercises, listWorkouts, saveProgram, saveRoutine, saveWorkout, startRoutineWorkout, startWorkout } from '../../db/repository';
import { toDateKey } from '../../lib/dates';
import { ensureSeeded } from '../../db/seed';
import { entry, item, set, wk } from '../../test/factories';
import { cleanup } from '@testing-library/react';
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

const rows = async (name = 'ベンチプレス') => {
  const card = await screen.findByRole('region', { name });
  return within(card).getAllByRole('group', { name: /セット目|ウォームアップ/ });
};

test('前回のトップセットと、行ごとの前回値・プレースホルダーを表示', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  expect(await screen.findByText('前回 10/23 ・ 80kg × 8 @RPE8')).toBeInTheDocument();
  const [r1] = await rows();
  expect(within(r1).getByText('前回 80×8')).toBeInTheDocument();
  expect(within(r1).getByLabelText('重量')).toHaveAttribute('placeholder', '80');
  expect(within(r1).getByLabelText('回数')).toHaveAttribute('placeholder', '8');
});

test('セット追加で2行目の前回が出て、ウォームアップ切替で番号が繰り上がる', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: '＋ セット追加' }));
  let [r1, r2] = await rows();
  expect(within(r2).getByText('前回 80×7')).toBeInTheDocument();
  await userEvent.click(within(r1).getByRole('button', { name: '1セット目' }));
  [r1, r2] = await rows();
  expect(within(r1).getByRole('button', { name: 'Wウォームアップ' })).toBeInTheDocument();
  expect(within(r2).getByRole('button', { name: '1セット目' })).toBeInTheDocument();
  expect(within(r2).getByText('前回 80×8')).toBeInTheDocument();
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

test('過去編集で全セットの完了を外して保存すると、破棄確認のうえ削除', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const past = (await listWorkouts()).find((w) => w.endedAt !== null)!;
  renderRoute(`/workout/${past.id}`, '/workout/:id', <WorkoutPage />);
  const rs = await rows();
  for (const r of rs) {
    const b = within(r).getByRole('button', { name: '完了' });
    if (b.getAttribute('aria-pressed') === 'true') await userEvent.click(b);
  }
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await screen.findByTestId('location');
  expect(await getWorkout(past.id)).toBeUndefined();
});

describe('ルーティンから始めた記録画面', () => {
  let squatId = '';
  let workoutId = '';
  beforeEach(async () => {
    await resetDb();
    await ensureSeeded();
    const ex = await listExercises();
    benchId = ex.find((e) => e.name === 'ベンチプレス')!.id;
    squatId = ex.find((e) => e.name === 'スクワット')!.id;
    await saveWorkout(wk(new Date(2026, 9, 23, 18), [entry(benchId, [set({ weight: 80, reps: 5 }), set({ weight: 80, reps: 5 }), set({ weight: 80, reps: 5 })])]));
    const r = await saveRoutine({ name: 'PUSH', weekday: null, items: [item(benchId, { sets: 3, reps: '5', main: true }), item(squatId, { sets: 3, reps: '5' })] });
    workoutId = (await startRoutineWorkout(r.id)).id;
  });

  const header = (name: string) => screen.getByRole('button', { name: new RegExp(name), expanded: undefined });
  const saved = async () => (await getWorkout(workoutId))!;

  test('最初の種目だけ開き、別の種目を開くと前の種目は閉じる', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    expect(screen.getByRole('button', { name: /ベンチプレス/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /スクワット/, expanded: false })).toBeInTheDocument();
    await userEvent.click(header('スクワット'));
    expect(screen.getByRole('button', { name: /スクワット/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ベンチプレス/, expanded: false })).toBeInTheDocument();
  });

  test('ヘッダーにメインと目標、開いた種目におすすめとプレート図', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    const card = await screen.findByRole('region', { name: 'ベンチプレス' });
    expect(within(card).getByText('メイン')).toBeInTheDocument();
    expect(within(card).getByText('3セット×5 ・ レスト 3:00')).toBeInTheDocument();
    expect(within(card).getByText('今回のおすすめ')).toBeInTheDocument();
    expect(within(card).getByText('82.5')).toBeInTheDocument();
    expect(within(card).getByText('前回はスピードを保てたので+2.5kg')).toBeInTheDocument();
    expect(within(card).getByText('片側 25 + 5 + 1.25 ・ バー20kg')).toBeInTheDocument();
  });

  test('ステッパーで重量を上げると保存される', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    const [r1] = await rows();
    expect(within(r1).getByLabelText('重量')).toHaveValue('82.5');
    await userEvent.click(within(r1).getByRole('button', { name: '重量を増やす' }));
    expect(within(r1).getByLabelText('重量')).toHaveValue('85');
    await waitFor(async () => expect((await saved()).entries[0].sets[0].weight).toBe(85));
  });

  test('この種目を完了して次へ', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    await userEvent.click(screen.getByRole('button', { name: 'この種目を完了して次へ' }));
    await waitFor(async () => expect((await saved()).entries[0].sets.every((x) => x.done)).toBe(true));
    expect(within(screen.getByRole('region', { name: 'ベンチプレス' })).getByLabelText('種目完了')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /スクワット/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ベンチプレス/, expanded: false })).toBeInTheDocument();
  });

  test('スピード低下を記録し、再読み込み後も入力・完了と一緒に残る', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    const [r1] = await rows();
    await userEvent.click(within(r1).getByRole('button', { name: '重量を増やす' }));
    await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
    await userEvent.click(screen.getByRole('button', { name: '最後の回でスピードが落ちた' }));
    await waitFor(async () => expect((await saved()).entries[0].slowed).toBe(true));
    cleanup();
    renderRoute('/workout', '/workout', <WorkoutPage />);
    const [again] = await rows();
    expect(within(again).getByLabelText('重量')).toHaveValue('85');
    expect(within(again).getByRole('button', { name: '完了' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '最後の回でスピードが落ちた' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('最後の種目を完了すると、前に残っている未完了の種目に戻る', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    await userEvent.click(header('スクワット'));
    const sq = await rows('スクワット');
    for (const r of sq) {
      await userEvent.type(within(r).getByLabelText('重量'), '60');
    }
    await userEvent.click(screen.getByRole('button', { name: 'この種目を完了して次へ' }));
    expect(await screen.findByRole('button', { name: /ベンチプレス/, expanded: true })).toBeInTheDocument();
  });

  test('何も完了できなければ「次へ」でも開いたまま', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    await userEvent.click(header('スクワット'));
    await userEvent.click(screen.getByRole('button', { name: 'この種目を完了して次へ' }));
    expect(screen.getByRole('button', { name: /スクワット/, expanded: true })).toBeInTheDocument();
  });

  test('開いている種目を削除すると、どれも開かない', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    await userEvent.click(within(screen.getByRole('region', { name: 'ベンチプレス' })).getByRole('button', { name: 'メニュー' }));
    await userEvent.click(screen.getByRole('button', { name: '種目を削除' }));
    expect(screen.queryByRole('region', { name: 'ベンチプレス' })).toBeNull();
    expect(screen.queryByRole('button', { expanded: true })).toBeNull();
  });

  test('回復週はヘッダーのセット数も半分', async () => {
    await saveProgram({ startDate: toDateKey(Date.now() - 21 * 86_400_000), tests: { start: null, end: null } });
    renderRoute('/workout', '/workout', <WorkoutPage />);
    const card = await screen.findByRole('region', { name: 'ベンチプレス' });
    expect(await within(card).findByText('2セット×5 ・ レスト 3:00')).toBeInTheDocument();
  });

  test('前回なしの重量種目は「今回の目標」と回数表記', async () => {
    renderRoute('/workout', '/workout', <WorkoutPage />);
    await rows();
    await userEvent.click(header('スクワット'));
    const card = screen.getByRole('region', { name: 'スクワット' });
    expect(within(card).getByText('今回の目標')).toBeInTheDocument();
    expect(within(card).getByText('初回：フォームが崩れず、目標回数をきれいにこなせる重さで')).toBeInTheDocument();
  });
});

test('「この種目を完了して次へ」も空欄を前回値で埋める（セットの完了ボタンと同じ）', async () => {
  renderRoute('/workout', '/workout', <WorkoutPage />);
  await rows();
  await userEvent.click(screen.getByRole('button', { name: 'この種目を完了して次へ' }));
  await waitFor(async () => {
    const w = (await listWorkouts()).find((x) => x.id === activeId)!;
    expect(w.entries[0].sets[0]).toMatchObject({ weight: 80, reps: 8, done: true });
  });
});

test('保存に失敗したら知らせ、次の保存が成功したら消す', async () => {
  const { db } = await import('../../db/db');
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  const put = vi.spyOn(db.workouts, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした');
  put.mockRestore();
  await userEvent.type(within(r1).getByLabelText('RPE'), '8');
  await waitFor(() => expect(screen.queryByText(/保存できませんでした/)).toBeNull());
});

test('終了するとレストタイマーも止まり、次のワークアウトに持ち越さない', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderRoute('/workout', '/workout', <WorkoutPage />);
  const [r1] = await rows();
  await userEvent.click(within(r1).getByRole('button', { name: '完了' }));
  expect(await screen.findByText('REST')).toBeInTheDocument();
  expect(localStorage.getItem('ironlog:rest')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: '終了' }));
  await screen.findByTestId('location');
  expect(localStorage.getItem('ironlog:rest')).toBeNull();
});

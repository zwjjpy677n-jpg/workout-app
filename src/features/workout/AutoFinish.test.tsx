import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { resetDb } from '../../db/db';
import { AUTO_FINISH_MS, autoFinishLongWorkout, getActiveWorkout, getWorkout, listWorkouts, saveWorkout } from '../../db/repository';
import { entry, set, wk } from '../../test/factories';
import { ROUTER_FUTURE } from '../../test/render';
import { AutoFinish } from './AutoFinish';

const START = new Date(2026, 10, 6, 18).getTime();
const active = (done: boolean) => wk(new Date(START), [entry('bench', [{ ...set({ weight: 60, reps: 10 }), done }])], { id: 'w1', endedAt: null, name: 'PUSH' });

beforeEach(async () => {
  await resetDb();
});
afterEach(() => vi.restoreAllMocks());

test('2時間を超えたら、終了時刻を2時間ちょうどにして保存する。超えていなければ何もしない', async () => {
  await saveWorkout(active(true));
  expect(await autoFinishLongWorkout(START + AUTO_FINISH_MS - 1)).toBeNull();
  expect(await getActiveWorkout()).toBeDefined();
  expect(await autoFinishLongWorkout(START + 5 * 60 * 60 * 1000)).toMatchObject({ result: 'saved' });
  expect((await getWorkout('w1'))?.endedAt).toBe(START + AUTO_FINISH_MS);
  expect(await getActiveWorkout()).toBeUndefined();
});

test('完了したセットが無ければ、保存せずに消す', async () => {
  await saveWorkout(active(false));
  expect(await autoFinishLongWorkout(START + AUTO_FINISH_MS)).toMatchObject({ result: 'discarded' });
  expect(await listWorkouts()).toEqual([]);
});

function Where() {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
}

test('記録の画面を開いているときに2時間を超えたら、知らせてカレンダーへ移る', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(START + AUTO_FINISH_MS - 30_000);
  await saveWorkout(active(true));
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={['/workout']} future={ROUTER_FUTURE}>
      <AutoFinish />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId('location')).toHaveTextContent('/workout');
  // 起動したときの確認（まだ2時間前なので何もしない）が終わるのを待つ
  await act(() => new Promise((r) => setTimeout(r, 100)));
  expect(alert).not.toHaveBeenCalled();
  await act(async () => {
    vi.setSystemTime(START + AUTO_FINISH_MS + 30_000);
    vi.advanceTimersByTime(60_000);
  });
  vi.useRealTimers();
  await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('「PUSH」が2時間を超えたので、自動で終了して保存しました'));
  expect(screen.getByTestId('location')).toHaveTextContent('/calendar?date=2026-11-06');
  expect((await getWorkout('w1'))?.endedAt).toBe(START + AUTO_FINISH_MS);
});

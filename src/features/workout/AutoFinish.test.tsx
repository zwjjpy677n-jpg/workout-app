import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { resetDb } from '../../db/db';
import { AUTO_FINISH_MS, autoFinishLongWorkout, getActiveWorkout, getWorkout, listWorkouts, resumeWorkout, saveWorkout } from '../../db/repository';
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

async function runPast2h(answer: boolean) {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(START + AUTO_FINISH_MS - 30_000);
  await saveWorkout(active(true));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer);
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
  expect(confirm).not.toHaveBeenCalled();
  await act(async () => {
    vi.setSystemTime(START + AUTO_FINISH_MS + 30_000);
    vi.advanceTimersByTime(60_000);
  });
  vi.useRealTimers();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith('「PUSH」が2時間を超えたので、自動で終了して保存しました。\nまだ続けるなら「OK」で続きから再開します'));
}

test('記録の画面を開いているときに2時間を超えたら、終了して知らせ、続けなければカレンダーへ移る', async () => {
  await runPast2h(false);
  await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/calendar?date=2026-11-06'));
  expect((await getWorkout('w1'))?.endedAt).toBe(START + AUTO_FINISH_MS);
});

test('「OK」なら続きから再開して記録の画面のまま', async () => {
  await runPast2h(true);
  await vi.waitFor(async () => expect((await getActiveWorkout())?.id).toBe('w1'));
  expect(screen.getByTestId('location')).toHaveTextContent('/workout');
});

test('再開すると記録中に戻り、2時間は再開したときから数える。ほかに記録中があれば再開しない', async () => {
  await saveWorkout({ ...active(true), endedAt: START + AUTO_FINISH_MS });
  const at = START + 3 * 60 * 60 * 1000;
  expect(await resumeWorkout('w1', at)).toBe('resumed');
  expect(await getWorkout('w1')).toMatchObject({ endedAt: null, resumedAt: at, startedAt: START });
  expect(await autoFinishLongWorkout(at + AUTO_FINISH_MS - 1)).toBeNull();
  expect(await autoFinishLongWorkout(at + AUTO_FINISH_MS + 5000)).toMatchObject({ result: 'saved' });
  expect((await getWorkout('w1'))?.endedAt).toBe(at + AUTO_FINISH_MS);
  await saveWorkout(wk(new Date(at), [], { id: 'w2', endedAt: null }));
  expect(await resumeWorkout('w1', at)).toBe('busy');
});

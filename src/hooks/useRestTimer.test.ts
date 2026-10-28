import { act, renderHook } from '@testing-library/react';
import { beep, setSoundPrefs } from '../lib/sound';
import { useRestTimer } from './useRestTimer';

vi.mock('../lib/sound', async (orig) => ({ ...(await orig<typeof import('../lib/sound')>()), beep: vi.fn() }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('start → 時間経過で減る', () => {
  const { result } = renderHook(() => useRestTimer());
  act(() => result.current.start(90));
  expect(result.current).toMatchObject({ remaining: 90, total: 90, running: true });
  act(() => vi.advanceTimersByTime(30_000));
  expect(result.current.remaining).toBe(60);
});

test('add で増減、0未満にならず停止', () => {
  const { result } = renderHook(() => useRestTimer());
  act(() => result.current.start(90));
  act(() => result.current.add(15));
  expect(result.current.remaining).toBe(105);
  act(() => result.current.add(-200));
  expect(result.current).toMatchObject({ remaining: 0, running: false });
});

test('0到達で停止しバイブ、skip で停止', () => {
  const vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  const { result } = renderHook(() => useRestTimer());
  act(() => result.current.start(3));
  act(() => vi.advanceTimersByTime(4000));
  expect(result.current).toMatchObject({ remaining: 0, running: false });
  expect(vibrate).toHaveBeenCalledWith(300);
  act(() => result.current.start(60));
  act(() => result.current.skip());
  expect(result.current.running).toBe(false);
});

describe('再読み込みと終了表示', () => {
  beforeEach(() => localStorage.clear());

  test('アンマウントしても残り時間が続く（再読み込み）', () => {
    const a = renderHook(() => useRestTimer());
    act(() => a.result.current.start(90));
    a.unmount();
    act(() => vi.advanceTimersByTime(10_000));
    const b = renderHook(() => useRestTimer());
    expect(b.result.current).toMatchObject({ running: true, remaining: 80, total: 90 });
  });

  test('スキップ後は再読み込みしても出てこない', () => {
    const a = renderHook(() => useRestTimer());
    act(() => a.result.current.start(90));
    act(() => a.result.current.skip());
    a.unmount();
    expect(renderHook(() => useRestTimer()).result.current.running).toBe(false);
  });

  test('0になると finished が立ち、8秒で消える。dismiss でも消える', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(2));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toMatchObject({ running: false, finished: true });
    act(() => vi.advanceTimersByTime(8000));
    expect(result.current.finished).toBe(false);
    act(() => result.current.start(1));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.finished).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.finished).toBe(false);
  });

  test('スキップでは finished にならない', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(30));
    act(() => result.current.skip());
    expect(result.current.finished).toBe(false);
  });
});

describe('終了の音', () => {
  beforeEach(() => vi.mocked(beep).mockClear());

  test('残り3・2・1秒で短い音、0で終了の音', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(5));
    act(() => vi.advanceTimersByTime(1000));
    expect(beep).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(1000));
    expect(vi.mocked(beep).mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick']);
    act(() => vi.advanceTimersByTime(1000));
    expect(vi.mocked(beep).mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'end']);
  });

  test('音をオフにすると鳴らない', () => {
    setSoundPrefs({ on: false, silent: false });
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(3));
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.finished).toBe(true);
    expect(beep).not.toHaveBeenCalled();
  });
});

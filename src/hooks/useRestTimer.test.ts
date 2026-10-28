import { act, renderHook } from '@testing-library/react';
import { useRestTimer } from './useRestTimer';

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

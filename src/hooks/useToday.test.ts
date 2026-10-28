import { act, renderHook } from '@testing-library/react';
import { toDateKey } from '../lib/dates';
import { useToday } from './useToday';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('日付が変わると更新される', () => {
  vi.setSystemTime(new Date(2026, 9, 28, 23, 59, 30));
  const { result } = renderHook(() => useToday());
  expect(toDateKey(result.current)).toBe('2026-10-28');
  act(() => vi.advanceTimersByTime(29_000));
  expect(toDateKey(result.current)).toBe('2026-10-28');
  act(() => vi.advanceTimersByTime(2_000));
  expect(toDateKey(result.current)).toBe('2026-10-29');
  act(() => vi.advanceTimersByTime(86_400_000));
  expect(toDateKey(result.current)).toBe('2026-10-30');
});

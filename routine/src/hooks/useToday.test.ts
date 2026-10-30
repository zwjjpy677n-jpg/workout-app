import { act, renderHook } from '@testing-library/react';
import { useToday } from './useToday';

afterEach(() => vi.useRealTimers());

test('画面に戻ったときに日付を計算し直す', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 30, 23, 59));
  const { result } = renderHook(() => useToday());
  expect(result.current).toBe('2026-10-30');
  vi.setSystemTime(new Date(2026, 9, 31, 0, 1));
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe('2026-10-31');
});

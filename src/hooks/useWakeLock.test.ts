import { renderHook } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

test('表示中は画面が消えないようにし、離れたら解除。非対応端末では何もしない', async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ release });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  const { unmount } = renderHook(() => useWakeLock(true));
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  unmount();
  await vi.waitFor(() => expect(release).toHaveBeenCalled());

  Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
  expect(() => renderHook(() => useWakeLock(true)).unmount()).not.toThrow();
});

test('active=false なら要求しない', () => {
  const request = vi.fn().mockResolvedValue({ release: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  renderHook(() => useWakeLock(false));
  expect(request).not.toHaveBeenCalled();
});

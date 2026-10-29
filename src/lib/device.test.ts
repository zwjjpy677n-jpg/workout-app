const { native, share, write, read, writeFile } = vi.hoisted(() => ({ native: { value: true }, share: vi.fn(), write: vi.fn(), read: vi.fn(), writeFile: vi.fn() }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile }, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }));
vi.mock('./platform', async (orig) => ({ ...(await orig<typeof import('./platform')>()), isNativeApp: () => native.value }));
vi.mock('@capacitor/share', () => ({ Share: { share } }));
vi.mock('@capacitor/clipboard', () => ({ Clipboard: { write, read } }));

import { canReadClipboard, copyText, readClipboard, saveFile, shareSheet } from './device';

beforeEach(() => {
  for (const f of [share, write, read, writeFile]) f.mockReset();
});

describe('アプリ', () => {
  beforeEach(() => (native.value = true));

  test('共有: 成功は shared、「Share canceled」は cancelled、それ以外は例外', async () => {
    share.mockResolvedValueOnce({});
    expect(await shareSheet({ text: 'hi' })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi' });
    share.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await shareSheet({ text: 'hi' })).toBe('cancelled');
    share.mockRejectedValueOnce(new Error('boom'));
    await expect(shareSheet({ text: 'hi' })).rejects.toThrow('boom');
  });

  test('コピーと貼り付けは Clipboard プラグイン', async () => {
    write.mockResolvedValue(undefined);
    read.mockResolvedValue({ value: 'pasted', type: 'text/plain' });
    await copyText('abc');
    expect(write).toHaveBeenCalledWith({ string: 'abc' });
    expect(canReadClipboard()).toBe(true);
    expect(await readClipboard()).toBe('pasted');
  });
});

describe('Web', () => {
  beforeEach(() => (native.value = false));

  test('共有: navigator.share が無ければ unavailable、AbortError は cancelled', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    expect(await shareSheet({ text: 'hi' })).toBe('unavailable');
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), configurable: true });
    expect(await shareSheet({ text: 'hi' })).toBe('cancelled');
    expect(share).not.toHaveBeenCalled();
  });

  test('コピーと貼り付けは navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText, readText: vi.fn().mockResolvedValue('web') }, configurable: true });
    await copyText('abc');
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(await readClipboard()).toBe('web');
    expect(write).not.toHaveBeenCalled();
  });
});

test('アプリでのファイル保存: Cache に書いて、その uri で共有画面。キャンセルは cancelled', async () => {
  native.value = true;
  writeFile.mockResolvedValue({ uri: 'file:///cache/grind-2026-10-29.json' });
  share.mockResolvedValueOnce({});
  expect(await saveFile('grind-2026-10-29.json', '{"a":1}')).toBe('saved');
  expect(writeFile).toHaveBeenCalledWith({ path: 'grind-2026-10-29.json', data: '{"a":1}', directory: 'CACHE', encoding: 'utf8' });
  expect(share).toHaveBeenCalledWith({ files: ['file:///cache/grind-2026-10-29.json'] });
  share.mockRejectedValueOnce(new Error('Share canceled'));
  expect(await saveFile('grind-2026-10-29.json', '{}')).toBe('cancelled');
});

test('Web でのファイル保存はダウンロード', async () => {
  native.value = false;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
  expect(await saveFile('grind.json', '{}')).toBe('saved');
  expect(click).toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
});

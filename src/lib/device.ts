import { Clipboard } from '@capacitor/clipboard';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './platform';

// 共有・コピー・貼り付けを、アプリでは iPhone の仕組みで、Web ではブラウザの仕組みで行う

/** 共有画面を出す。キャンセルは 'cancelled'、Web で共有が無いときは 'unavailable'、それ以外の失敗は例外 */
export async function shareSheet(opts: { text?: string; files?: string[] }): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (isNativeApp()) {
    try {
      await Share.share(opts);
      return 'shared';
    } catch (e) {
      if (/cancel/i.test(e instanceof Error ? e.message : String(e))) return 'cancelled';
      throw e;
    }
  }
  if (!navigator.share) return 'unavailable';
  try {
    await navigator.share({ text: opts.text });
    return 'shared';
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'InvalidStateError')) return 'cancelled';
    throw e;
  }
}

export async function copyText(text: string): Promise<void> {
  if (isNativeApp()) await Clipboard.write({ string: text });
  else await navigator.clipboard.writeText(text);
}

export const canReadClipboard = (): boolean => isNativeApp() || !!navigator.clipboard?.readText;

export async function readClipboard(): Promise<string> {
  if (isNativeApp()) return (await Clipboard.read()).value;
  return navigator.clipboard.readText();
}

/** ファイルとして保存する。アプリでは一時フォルダに書いて共有画面（「ファイルに保存」など）を出し、Web ではダウンロードする */
export async function saveFile(name: string, text: string): Promise<'saved' | 'cancelled'> {
  if (isNativeApp()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    return (await shareSheet({ files: [uri] })) === 'cancelled' ? 'cancelled' : 'saved';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return 'saved';
}

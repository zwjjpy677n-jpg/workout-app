// 共有リンクの中身: 種類1文字 + 版1文字 + base64url(deflate-raw(JSON))。URL の # 以降に入れるのでサーバーには送られない
export type ShareKind = 'r' | 'f' | 'm';

const VERSION = 1;
const KINDS: ShareKind[] = ['r', 'f', 'm'];

export class ShareError extends Error {
  constructor(public code: 'invalid' | 'newer' | 'unsupported' | 'too-large') {
    super(code);
  }
}

export const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes).catch(() => {});
  void writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodeShare(kind: ShareKind, data: unknown): Promise<string> {
  if (!canCompress()) throw new ShareError('unsupported');
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate-raw'));
  return `${kind}${VERSION}${toBase64Url(packed)}`;
}

/** 貼り付けた文から中身を取り出す。d= があればその後ろを、無ければ空白を除いた全体を中身とみなす */
export function shareData(text: string): string {
  const m = /[?&]d=([A-Za-z0-9_-]+)/.exec(text);
  return m ? m[1] : text.trim();
}

export async function decodeShare(text: string): Promise<{ kind: ShareKind; data: unknown }> {
  const body = shareData(text);
  if (!/^[a-z]\d[A-Za-z0-9_-]+$/.test(body)) throw new ShareError('invalid');
  const kind = body[0] as ShareKind;
  if (!KINDS.includes(kind)) throw new ShareError('invalid');
  if (Number(body[1]) > VERSION) throw new ShareError('newer');
  if (Number(body[1]) < 1) throw new ShareError('invalid');
  if (!canCompress()) throw new ShareError('unsupported');
  try {
    const bytes = await pipe(fromBase64Url(body.slice(2)), new DecompressionStream('deflate-raw'));
    return { kind, data: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    throw new ShareError('invalid');
  }
}

export const shareUrl = (data: string) => `${location.origin}${location.pathname}#/friends/add?d=${data}`;

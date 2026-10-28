import { ShareError } from './codec';

// 受け取ったリンクの中身の検証用。外れたらすべて ShareError('invalid')
export const fail = (): never => {
  throw new ShareError('invalid');
};
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const int = (v: unknown, lo: number, hi: number) => (isNum(v) && Number.isInteger(v) && v >= lo && v <= hi ? v : fail());
export const numOrNull = (v: unknown, lo: number, hi: number) => (v === null ? null : isNum(v) && v >= lo && v <= hi ? v : fail());
export const str = (v: unknown, lo: number, hi: number) => (typeof v === 'string' && v.length >= lo && v.length <= hi ? v : fail());
export const id = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : fail());
export const arr = (v: unknown, max: number) => (Array.isArray(v) && v.length <= max ? v : fail());
export const tup = (v: unknown, n: number) => (Array.isArray(v) && v.length === n ? v : fail());
export const nullable = <T>(v: unknown, f: (v: unknown) => T): T | null => (v === null ? null : f(v));
export const num = (v: unknown, lo: number, hi: number) => (isNum(v) && v >= lo && v <= hi ? v : fail());

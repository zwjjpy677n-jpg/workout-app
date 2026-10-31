import type { Condition } from './types';

const COND: [keyof Condition, string][] = [['sleep', '睡眠'], ['fatigue', '疲労感'], ['motivation', 'やる気']];

/** 「睡眠 5 ・ 疲労感 5 ・ やる気 4」。入れていない項目は出さない */
export function conditionText(c: Condition): string {
  return COND.filter(([k]) => c[k] != null).map(([k, l]) => `${l} ${c[k]}`).join(' ・ ');
}

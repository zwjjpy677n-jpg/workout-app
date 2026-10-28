let lastStamp = 0;

/** 作成順の並びが崩れないよう、同じミリ秒でも必ず増える作成時刻 */
export function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

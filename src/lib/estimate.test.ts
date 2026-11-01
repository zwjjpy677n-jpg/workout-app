import { estimateMinutes, estimateText } from './estimate';
import type { Exercise } from './types';

const ex = (id: string, restSec: number): Exercise => ({ id, name: id, bodyPart: 'chest', type: 'weight', restSec, archived: false, createdAt: 0, barKg: null });
const map = new Map([['a', ex('a', 180)], ['b', ex('b', 90)]]);

test('セットの時間＋レスト（最後のセットのあとは数えない）を5分刻みで切り上げ', () => {
  // a: 3セット×(45+180)=675、b: 3セット×(45+90)=405、最後のレスト90を引いて 990秒 = 16.5分 → 20分
  expect(estimateMinutes([{ exerciseId: 'a', sets: 3, restSec: null }, { exerciseId: 'b', sets: 3, restSec: null }], map)).toBe(20);
});

test('ルーティンで決めたレストを優先し、セット数は回復週などで変えられる', () => {
  // a: 4×(45+60)=420 − 60 = 360秒 = 6分 → 10分。半分（2セット）なら 2×105−60=150秒 → 5分
  expect(estimateMinutes([{ exerciseId: 'a', sets: 4, restSec: 60 }], map)).toBe(10);
  expect(estimateMinutes([{ exerciseId: 'a', sets: 4, restSec: 60 }], map, (n) => Math.ceil(n / 2))).toBe(5);
});

test('種目が無ければ 0 で、表示は空', () => {
  expect(estimateMinutes([], map)).toBe(0);
  expect(estimateText(0)).toBe('');
  expect(estimateText(55)).toBe('約55分');
});

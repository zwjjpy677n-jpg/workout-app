import { percentTable, platesFor, roundTo } from './tools';

test('roundTo', () => {
  expect(roundTo(83.6, 2.5)).toBe(82.5);
  expect(roundTo(83.8, 2.5)).toBe(85);
});

test('percentTable(104.5)', () => {
  const t = percentTable(104.5);
  expect(t[0]).toEqual({ percent: 100, kg: 105 });
  expect(t.find((r) => r.percent === 80)?.kg).toBe(82.5);
  expect(t.at(-1)).toEqual({ percent: 50, kg: 52.5 });
  expect(t).toHaveLength(11);
});

const STD = [25, 20, 15, 10, 5, 2.5, 1.25];
test('platesFor', () => {
  expect(platesFor(100, 20, STD)).toEqual({ perSide: [25, 15], achievedKg: 100, diffKg: 0 });
  expect(platesFor(82.5, 20, STD)).toEqual({ perSide: [25, 5, 1.25], achievedKg: 82.5, diffKg: 0 });
  expect(platesFor(61, 20, STD)).toEqual({ perSide: [20], achievedKg: 60, diffKg: 1 });
  expect(platesFor(15, 20, STD)).toEqual({ perSide: [], achievedKg: 20, diffKg: -5 });
  expect(platesFor(102.5, 20, [20, 10, 1.25])).toEqual({ perSide: [20, 20, 1.25], achievedKg: 102.5, diffKg: 0 });
  expect(platesFor(20, 20, STD)).toEqual({ perSide: [], achievedKg: 20, diffKg: 0 });
});

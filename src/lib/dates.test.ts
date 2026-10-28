import { formatMD, formatMDW, monthGrid, startOfWeek, toDateKey } from './dates';

test('日曜は月曜始まりの当週に入る', () => {
  const sun = new Date(2026, 10, 1, 23, 59).getTime(); // 2026-11-01 (日)
  expect(new Date(startOfWeek(sun))).toEqual(new Date(2026, 9, 26, 0, 0));
  expect(toDateKey(sun)).toBe('2026-11-01');
});

test('月曜はその日が週の始まり', () => {
  const mon = new Date(2026, 9, 26, 0, 0, 1).getTime();
  expect(new Date(startOfWeek(mon))).toEqual(new Date(2026, 9, 26));
});

test('monthGrid: 2026年10月は9/28(月)始まりで35マス', () => {
  const g = monthGrid(2026, 9);
  expect(g[0]).toEqual({ key: '2026-09-28', day: 28, inMonth: false });
  expect(g).toHaveLength(35);
  expect(g.filter((c) => c.inMonth)).toHaveLength(31);
  expect(g.at(-1)).toEqual({ key: '2026-11-01', day: 1, inMonth: false });
});

test('formatMD / formatMDW', () => {
  const t = new Date(2026, 9, 22, 9).getTime();
  expect(formatMD(t)).toBe('10/22');
  expect(formatMDW(t)).toBe('10/22 THU');
});

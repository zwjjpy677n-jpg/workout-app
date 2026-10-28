import { isDeload, programStatus, targetNumber, weekOf } from './program';

test('targetNumber', () => {
  expect(targetNumber('5')).toBe(5);
  expect(targetNumber('8〜10')).toBe(8);
  expect(targetNumber('左右8')).toBe(8);
  expect(targetNumber('左右30秒')).toBe(30);
  expect(targetNumber('6〜8本')).toBe(6);
  expect(targetNumber('最大')).toBeNull();
});

test('weekOf: 開始日が1週目、7日後が2週目、前日は0', () => {
  expect(weekOf('2026-10-26', '2026-10-26')).toBe(1);
  expect(weekOf('2026-10-26', '2026-11-01')).toBe(1);
  expect(weekOf('2026-10-26', '2026-11-02')).toBe(2);
  expect(weekOf('2026-10-26', '2026-10-25')).toBe(0);
  expect(weekOf('2026-10-26', '2026-12-21')).toBe(9);
});

test('isDeload', () => expect([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isDeload)).toEqual([4, 8]));

test('programStatus', () => {
  const p = { startDate: '2026-10-05', tests: { start: null, end: null } };
  expect(programStatus(p, '2026-10-28')).toMatchObject({ active: true, week: 4, inRange: true, deload: true, label: '回復週：重さはそのまま、セット数を半分に' });
  expect(programStatus(p, '2026-10-12')).toMatchObject({ week: 2, deload: false, label: '' });
  expect(programStatus(p, '2026-10-04').label).toBe('開始前');
  expect(programStatus(p, '2026-12-01')).toMatchObject({ week: 9, inRange: false, deload: false, label: '8週間完了' });
  expect(programStatus(null, '2026-10-28')).toEqual({ active: false, week: 0, inRange: false, deload: false, label: '' });
});

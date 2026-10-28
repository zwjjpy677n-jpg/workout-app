import { isDeload, mainExerciseIds, programStatus, targetNumber, weekOf } from './program';

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

test('mainExerciseIds は出現順・重複なし', () => {
  const rs = [
    { id: 'a', name: 'A', weekday: 1, createdAt: 0, items: [{ exerciseId: 'sq', sets: 3, reps: '5', main: true, inc: 2.5, note: '' }, { exerciseId: 'x', sets: 3, reps: '5', main: false, inc: 2.5, note: '' }] },
    { id: 'b', name: 'B', weekday: 2, createdAt: 1, items: [{ exerciseId: 'bp', sets: 3, reps: '5', main: true, inc: 2.5, note: '' }, { exerciseId: 'sq', sets: 3, reps: '5', main: true, inc: 2.5, note: '' }] },
  ];
  expect(mainExerciseIds(rs)).toEqual(['sq', 'bp']);
});

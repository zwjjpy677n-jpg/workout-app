import { addDays, weekday } from './day';

test('addDays は月・年の変わり目をまたぐ', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('weekday は 0=日', () => {
  expect(weekday('2026-10-30')).toBe(5);
});

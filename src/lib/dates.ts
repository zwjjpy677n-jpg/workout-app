const DAY = 86_400_000;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** その週の月曜 00:00（ローカル） */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
}

export function endOfWeek(ts: number): number {
  const s = new Date(startOfWeek(ts));
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7).getTime();
}

export function monthGrid(year: number, month0: number): { key: string; day: number; inMonth: boolean }[] {
  const first = new Date(year, month0, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month0, 1 - lead + i);
    cells.push({ key: toDateKey(d.getTime()), day: d.getDate(), inMonth: d.getMonth() === month0 });
  }
  return cells;
}

export function formatMD(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatMDW(ts: number): string {
  return `${formatMD(ts)} ${WEEKDAYS[new Date(ts).getDay()]}`;
}

export { DAY };

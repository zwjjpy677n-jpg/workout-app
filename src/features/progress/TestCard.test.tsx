import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { ensureMenuSeeded } from '../../db/menuSeed';
import { getProgram, saveProgram, setBodyweight } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { TestCard } from './TestCard';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 10));
  await resetDb();
  await ensureSeeded();
  await ensureMenuSeeded();
});
afterEach(() => vi.useRealTimers());

test('プログラムなしでは何も出ない', async () => {
  const { container } = render(<TestCard />);
  await new Promise((r) => setTimeout(r, 50));
  expect(container).toBeEmptyDOMElement();
});

async function enter(which: string, squat: string, bw: string) {
  await userEvent.click(screen.getByRole('button', { name: which }));
  const dlg = screen.getByRole('dialog');
  await userEvent.clear(within(dlg).getByLabelText('スクワット 5RM'));
  await userEvent.type(within(dlg).getByLabelText('スクワット 5RM'), squat);
  await userEvent.clear(within(dlg).getByLabelText('体重'));
  await userEvent.type(within(dlg).getByLabelText('体重'), bw);
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
}

test('開始時と8週目を入力すると伸びを表示', async () => {
  await saveProgram({ startDate: '2026-09-01', tests: { start: null, end: null } });
  render(<TestCard />);
  const card = await screen.findByRole('region', { name: '8週間テスト' });
  expect(within(card).getAllByRole('row').slice(1).map((r) => r.firstElementChild?.textContent)).toEqual(['スクワット', 'ヘックスバーデッドリフト', 'ピンベンチ', '体重']);
  await enter('開始時を入力', '100', '70');
  await waitFor(async () => expect((await getProgram())?.tests.start).toMatchObject({ date: '2026-10-28', bodyweight: 70 }));
  await enter('8週目を入力', '110', '71.5');
  const squatRow = (await within(card).findByText('▲ 10kg')).closest('tr')!;
  expect(squatRow).toHaveTextContent('スクワット100kg110kg▲ 10kg');
  expect(within(card).getByText('▲ 1.5kg').closest('tr')).toHaveTextContent('体重');
});

test('体重の初期値は今日の体重記録', async () => {
  await saveProgram({ startDate: '2026-09-01', tests: { start: null, end: null } });
  await setBodyweight('2026-10-28', 72.4);
  render(<TestCard />);
  await userEvent.click(await screen.findByRole('button', { name: '開始時を入力' }));
  expect(within(screen.getByRole('dialog')).getByLabelText('体重')).toHaveValue('72.4');
});

test('保存しても、今はメインでない種目の過去のテスト値は残る', async () => {
  await saveProgram({ startDate: '2026-09-01', tests: { start: { date: '2026-09-01', bodyweight: 70, lifts: { formerMain: 90 } }, end: null } });
  render(<TestCard />);
  await screen.findByRole('region', { name: '8週間テスト' });
  await enter('開始時を入力', '100', '70');
  await waitFor(async () => expect((await getProgram())?.tests.start?.lifts).toMatchObject({ formerMain: 90 }));
  expect(Object.values((await getProgram())!.tests.start!.lifts)).toContain(100);
});

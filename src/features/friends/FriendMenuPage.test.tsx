import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { saveImportedShare } from '../../db/friends';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, item, routine, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendMenuPage } from './FriendMenuPage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const bp = ex('bp-uuid-000002', { name: 'ベンチプレス' });
const DAY = 86400_000;

beforeEach(async () => {
  await resetDb();
  const now = Date.now();
  const profile = { id: 'friend000001', name: 'じろう' };
  const legDay = (daysAgo: number, kg: number) =>
    wk(now - daysAgo * DAY, [entry(sq.id, [set({ weight: kg, reps: 5 }), set({ weight: kg, reps: 5 })])], { id: `leg${daysAgo}-uuid-x`, name: 'LEG' });
  const other = wk(now - 2 * DAY, [entry(bp.id, [set({ weight: 80, reps: 8 })])], { id: 'push-uuid-xx', name: 'PUSH' });
  await saveImportedShare(buildSharePayload({ profile, exercises: [sq, bp], workouts: [legDay(20, 90)], routines: [routine('LEG', [item(sq.id, { sets: 3, reps: '5' })], { weekday: 1 })] }, now - 19 * DAY), now - 19 * DAY);
  await saveImportedShare(
    buildSharePayload({ profile, exercises: [sq, bp], workouts: [legDay(20, 90), legDay(13, 95), legDay(6, 100), other], routines: [routine('LEG', [item(sq.id, { sets: 5, reps: '5' })], { weekday: 1 })] }, now - DAY),
    now - DAY,
  );
});

const open = () => renderRoute(`/friends/friend000001/menus/${encodeURIComponent('LEG')}`, '/friends/:id/menus/:name', <FriendMenuPage />);

test('最新のメニューと前の版、そのメニューでやった記録が新しい順（前の記録も残る）', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'じろうさん ・ LEG（月）' })).toBeInTheDocument();
  expect(screen.getByText('5セット×5')).toBeInTheDocument();
  const prev = screen.getByRole('region', { name: '前の版' });
  expect(within(prev).getByText(/受け取り/)).toBeInTheDocument();
  expect(within(prev).getByText('3セット×5')).toBeInTheDocument();
  const records = within(screen.getByRole('list', { name: 'このメニューの記録' })).getAllByRole('listitem');
  expect(records.map((r) => r.textContent)).toEqual([
    expect.stringContaining('100kg × 5 / 5'),
    expect.stringContaining('95kg × 5 / 5'),
    expect.stringContaining('90kg × 5 / 5'),
  ]);
  expect(screen.queryByText(/80kg/)).toBeNull();
});

test('メニューの種目ごとのグラフ: 指標を切り替えられ、今の値が出る', async () => {
  open();
  await screen.findByRole('heading', { name: 'じろうさん ・ LEG（月）' });
  expect(screen.getByRole('button', { name: 'スクワット', pressed: true })).toBeInTheDocument();
  const metrics = screen.getByRole('group', { name: '指標' });
  await userEvent.click(within(metrics).getByRole('button', { name: '最大重量' }));
  expect(screen.getByLabelText('今の値')).toHaveTextContent('100kg');
});

test('無いメニューは友達の詳細へ戻る', async () => {
  renderRoute('/friends/friend000001/menus/NOPE', '/friends/:id/menus/:name', <FriendMenuPage />);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001');
});

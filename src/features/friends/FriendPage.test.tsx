import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, resetDb } from '../../db/db';
import { emptyCondition } from '../../lib/types';
import { getFriend, listFriendWorkouts, saveImportedShare } from '../../db/friends';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, item, routine, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendPage } from './FriendPage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const bp = ex('bp-uuid-000002', { name: 'ベンチプレス' });
const NOW = new Date(2026, 9, 28, 20).getTime();

beforeEach(async () => {
  await resetDb();
  const workouts = [
    wk(new Date(2026, 9, 27, 18), [entry(sq.id, [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })])], { id: 'aaaaaaaa-1', name: 'LEG' }),
    wk(new Date(2026, 9, 21, 18), [entry(bp.id, [set({ weight: 80, reps: 8 })])], { id: 'bbbbbbbb-1', name: 'PUSH' }),
  ];
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq, bp], workouts }, NOW), NOW);
});

const open = () => renderRoute('/friends/friend000001', '/friends/:id', <FriendPage />);

test('週の見出しと日ごとの記録が新しい順に出る', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'じろう' })).toBeInTheDocument();
  expect(screen.getByText('受け取り 10/28 ・ 記録 2回分')).toBeInTheDocument();
  const weeks = screen.getAllByRole('region');
  expect(weeks.map((w) => within(w).getByRole('heading').textContent)).toEqual(['10/26〜11/1 ・ 1日 ・ 1.0t', '10/19〜10/25 ・ 1日 ・ 640kg']);
  expect(within(weeks[0]).getByText('10/27 TUE LEG')).toBeInTheDocument();
  expect(within(weeks[0]).getByText('100kg × 5 / 5')).toBeInTheDocument();
});

test('種目タブで自己ベストと最後の日、押すとグラフへ', async () => {
  open();
  await userEvent.click(await screen.findByRole('tab', { name: '種目' }));
  const rows = screen.getAllByRole('button', { name: /最後/ });
  expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('スクワット'), expect.stringContaining('ベンチプレス')]);
  expect(rows[0]).toHaveTextContent('脚');
  expect(rows[0]).toHaveTextContent('100kg × 5');
  expect(rows[0]).toHaveTextContent('最後 10/27');
  await userEvent.click(rows[0]);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001/exercise/sq-uuid-');
});

test('メニュータブ: 共有されたメニューを曜日順（なしは最後）で、メイン種目に印', async () => {
  const routines = [routine('PUSH', [item(bp.id, { sets: 3, reps: '8', main: true })], { weekday: 3 }), routine('LEG', [item(sq.id, { sets: 5, reps: '5' })], { weekday: 1 }), routine('自由', [item(sq.id)])];
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq, bp], workouts: [], routines }, NOW + 60_000), NOW + 60_000);
  open();
  await userEvent.click(await screen.findByRole('tab', { name: 'メニュー' }));
  const cards = await screen.findAllByRole('article');
  expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['LEG（月）', 'PUSH（水）', '自由']);
  expect(within(cards[1]).getByText('3セット×8')).toBeInTheDocument();
  expect(within(cards[1]).getByText('メイン')).toBeInTheDocument();
});

test('メニュータブ: メニューが共有されていなければ「まだメニューは共有されていません」', async () => {
  open();
  await userEvent.click(await screen.findByRole('tab', { name: 'メニュー' }));
  expect(await screen.findByText('じろうさんのメニューはまだ共有されていません')).toBeInTheDocument();
  expect(screen.queryByRole('article')).toBeNull();
});

test('削除すると一覧へ戻り、友達と記録が消える', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'この友達を削除' }));
  expect(window.confirm).toHaveBeenCalledWith('じろうさんと受け取った記録を削除しますか？');
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
  expect(await getFriend('friend000001')).toBeUndefined();
  expect(await listFriendWorkouts('friend000001')).toEqual([]);
});

test('いない友達なら友達タブへ戻る', async () => {
  renderRoute('/friends/nobody', '/friends/:id', <FriendPage />);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
});

test('メニュータブ: メニューを押すとそのメニューの記録とグラフへ', async () => {
  const routines = [routine('LEG', [item(sq.id, { sets: 5, reps: '5' })], { weekday: 1 })];
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq, bp], workouts: [], routines }, NOW + 60_000), NOW + 60_000);
  open();
  await userEvent.click(await screen.findByRole('tab', { name: 'メニュー' }));
  await userEvent.click(await screen.findByRole('button', { name: 'LEG（月）の記録とグラフ' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001/menus/LEG');
});

test('オンラインの友達の記録に「62分」が出る、リンクの友達の記録には出ない', async () => {
  const start = new Date(2026, 9, 27, 18).getTime();
  await db.friendWorkouts.put({
    id: 'friend000001:online01', friendId: 'friend000001', name: 'ONLINE', startedAt: start + 3600_000, endedAt: start + 3600_000 + 62 * 60_000,
    note: '', condition: emptyCondition(), routineId: null, entries: [entry(sq.id, [set({ weight: 100, reps: 5 })])],
  });
  open();
  expect(await screen.findByText('10/27 TUE ONLINE ・ 62分')).toBeInTheDocument();
  expect(screen.getByText('10/27 TUE LEG')).toBeInTheDocument();
  expect(screen.queryByText(/LEG ・/)).toBeNull();
});

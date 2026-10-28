import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { getFriend, listFriendWorkouts, saveImportedShare, saveProfileName } from '../../db/friends';
import { encodeShare } from '../../lib/share/codec';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, item, routine, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { ImportPage } from './ImportPage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const w = (id: string, d: Date) => wk(d, [entry(sq.id, [set({ weight: 100, reps: 5 })])], { id });
const payload = (workouts: ReturnType<typeof w>[], id = 'friend000001') =>
  buildSharePayload({ profile: { id, name: 'じろう' }, exercises: [sq], routines: [routine('LEG', [item(sq.id)])], workouts }, new Date(2026, 9, 28, 20).getTime());
const open = async (data: string) => renderRoute(`/friends/add?d=${data}`, '/friends/add', <ImportPage />);

beforeEach(() => resetDb());

test('初めての友達: 件数と期間を出し、保存すると詳細へ', async () => {
  await open(await encodeShare('r', payload([w('aaaaaaaa-1', new Date(2026, 8, 3, 18)), w('bbbbbbbb-1', new Date(2026, 9, 27, 18))])));
  expect(await screen.findByText('じろうさんの記録（2回分・9/3〜10/27）')).toBeInTheDocument();
  expect(screen.getByText('種目 1 ・ メニュー 1')).toBeInTheDocument();
  expect(screen.getByText('ホーム画面に追加した GRIND で使うには、このリンクをコピーして『友達』タブに貼り付けてください')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001');
  expect(await listFriendWorkouts('friend000001')).toHaveLength(2);
});

test('2回目: 前回の受け取りと新しい記録の数', async () => {
  await saveImportedShare(payload([w('aaaaaaaa-1', new Date(2026, 9, 20, 18))]), new Date(2026, 9, 21, 9).getTime());
  await open(await encodeShare('r', payload([w('aaaaaaaa-1', new Date(2026, 9, 20, 18)), w('bbbbbbbb-1', new Date(2026, 9, 27, 18))])));
  expect(await screen.findByText('前回の受け取り 10/21。新しい記録 1回分が追加されます')).toBeInTheDocument();
});

test('自分の記録は保存できない', async () => {
  const me = await saveProfileName('わたし');
  await open(await encodeShare('r', payload([w('aaaaaaaa-1', new Date(2026, 9, 27, 18))], me.id)));
  expect(await screen.findByText('自分の記録です')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
});

test('壊れたリンク・中身がおかしいリンク・まだ読めない種類', async () => {
  const { unmount } = await open('r1AAAA');
  expect(await screen.findByText('読み込めないリンクです')).toBeInTheDocument();
  unmount();
  const r2 = await open(await encodeShare('r', { id: 'x', n: '', at: 0, x: [], w: [], r: [], p: [] }));
  expect(await screen.findByText('読み込めないリンクです')).toBeInTheDocument();
  r2.unmount();
  await open(await encodeShare('f', { a: 1 }));
  expect(await screen.findByText('このアプリではまだ読み込めません。GRIND を最新にしてください')).toBeInTheDocument();
  expect(await getFriend('x')).toBeUndefined();
});

test('やめるで友達タブへ', async () => {
  await open(await encodeShare('r', payload([])));
  await userEvent.click(await screen.findByRole('button', { name: 'やめる' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
});

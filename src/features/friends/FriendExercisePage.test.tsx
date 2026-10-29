import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { saveImportedShare } from '../../db/friends';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendExercisePage } from './FriendExercisePage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const pull = ex('pu-uuid-000002', { name: '懸垂', type: 'bodyweight', bodyPart: 'back' });
const DAY = 86400_000;

beforeEach(async () => {
  await resetDb();
  const now = Date.now();
  const workouts = Array.from({ length: 7 }, (_, i) =>
    wk(now - (7 - i) * 3 * DAY, [entry(sq.id, [set({ weight: 90 + i * 2.5, reps: 5 }), set({ weight: 90 + i * 2.5, reps: 5 })]), entry(pull.id, [set({ weight: i, reps: 8 })])], { id: `w${i}-uuid-xyz` }),
  );
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq, pull], workouts }, now), now);
});

const open = (x8: string) => renderRoute(`/friends/friend000001/exercise/${x8}`, '/friends/:id/exercise/:x8', <FriendExercisePage />);

test('重量種目は推定1RM・最大重量・ボリュームを切り替えられ、自己ベストと直近5回が出る', async () => {
  open('sq-uuid-');
  expect(await screen.findByRole('heading', { name: 'じろうさん ・ スクワット' })).toBeInTheDocument();
  const metrics = screen.getByRole('group', { name: '指標' });
  expect(within(metrics).getAllByRole('button').map((b) => b.textContent)).toEqual(['推定1RM', '最大重量', 'ボリューム']);
  await userEvent.click(within(metrics).getByRole('button', { name: '最大重量' }));
  expect(within(metrics).getByRole('button', { name: '最大重量' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('今の値')).toHaveTextContent('105kg');
  expect(screen.getByText('105kg × 5')).toBeInTheDocument();
  const recent = screen.getByRole('list', { name: '直近の記録' });
  expect(within(recent).getAllByRole('listitem')).toHaveLength(5);
  expect(within(recent).getAllByRole('listitem')[0]).toHaveTextContent('105kg × 5 / 5');
});

test('自重種目は最大加重・総回数', async () => {
  open('pu-uuid-');
  const metrics = await screen.findByRole('group', { name: '指標' });
  expect(within(metrics).getAllByRole('button').map((b) => b.textContent)).toEqual(['最大加重', '総回数']);
});

test('存在しない種目は友達タブへ戻る', async () => {
  open('nothing1');
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
});

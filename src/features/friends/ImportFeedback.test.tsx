import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { listInbox } from '../../db/feedback';
import { saveProfileName } from '../../db/friends';
import { addExercise, deleteWorkout, saveWorkout } from '../../db/repository';
import { encodeShare } from '../../lib/share/codec';
import type { FeedbackPayload } from '../../lib/share/feedbackPayload';
import { entry, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendsPage } from './FriendsPage';
import { ImportPage } from './ImportPage';

let me = { id: '', name: '' };
let wid = '';
beforeEach(async () => {
  await resetDb();
  me = await saveProfileName('たろう');
  const e = await addExercise({ name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 120, barKg: 20 });
  wid = crypto.randomUUID();
  await saveWorkout(wk(new Date(2026, 9, 27, 18), [entry(e.id, [set({ weight: 100, reps: 5 })])], { id: wid }));
});
const payload = (o: Partial<FeedbackPayload> = {}): FeedbackPayload => ({
  id: 'friend000001', n: 'じろう', to: me.id, at: Math.floor(new Date(2026, 9, 28, 9).getTime() / 60000),
  c: [
    ['fid000000001', wid.slice(0, 8), null, null, 'いい日だね', Math.floor(new Date(2026, 9, 28, 8).getTime() / 60000)],
    ['fid000000002', null, '2026-10-26', null, '今週もおつかれ', Math.floor(new Date(2026, 9, 28, 9).getTime() / 60000)],
  ],
  ...o,
});
const open = async (p: FeedbackPayload) => renderRoute(`/friends/add?d=${await encodeShare('f', p)}`, '/friends/add', <ImportPage />);

test('確認 → 保存 → 友達タブへ。同じリンクをもう一度保存しても増えない', async () => {
  const { unmount } = await open(payload());
  expect(await screen.findByText('じろうさんからのフィードバック（2件）')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
  unmount();
  await open(payload());
  await userEvent.click(await screen.findByRole('button', { name: '保存' }));
  await screen.findByTestId('location');
  expect(await listInbox()).toHaveLength(2);
});

test('宛先が違うと保存できない', async () => {
  await open(payload({ to: 'someoneelse1' }));
  expect(await screen.findByText('あなた宛てではないフィードバックです')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
});

describe('届いたフィードバック（友達タブ）', () => {
  const inbox = async () => within(await screen.findByRole('region', { name: '届いたフィードバック' }));

  test('新しい順に未読で並び、押すと既読になってカレンダーのその日へ', async () => {
    const { importFeedback } = await import('../../db/feedback');
    await importFeedback(payload());
    renderRoute('/friends', '/friends', <FriendsPage />);
    const box = await inbox();
    const items = box.getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([expect.stringContaining('今週もおつかれ'), expect.stringContaining('いい日だね')]);
    expect(within(items[1]).getByLabelText('未読')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('じろうさん 10/28');
    await userEvent.click(items[1]);
    expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-27');
    expect((await listInbox()).find((f) => f.id === 'fid000000001')?.read).toBe(true);
  });

  test('週へのひとことはその週の月曜へ、記録が消えていても残り受け取った日へ', async () => {
    const { importFeedback } = await import('../../db/feedback');
    await deleteWorkout(wid);
    await importFeedback(payload());
    renderRoute('/friends', '/friends', <FriendsPage />);
    const box = await inbox();
    await userEvent.click(box.getByRole('button', { name: /今週もおつかれ/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-26');
  });

  test('記録が消えたコメントは受け取った日へ', async () => {
    const { importFeedback } = await import('../../db/feedback');
    await deleteWorkout(wid);
    await importFeedback(payload());
    renderRoute('/friends', '/friends', <FriendsPage />);
    const box = await inbox();
    await userEvent.click(box.getByRole('button', { name: /いい日だね/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/calendar?date=2026-10-28');
  });
});

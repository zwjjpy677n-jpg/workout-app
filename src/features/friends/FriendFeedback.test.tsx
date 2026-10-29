import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { listFeedbackOut } from '../../db/feedback';
import { saveImportedShare, saveProfileName } from '../../db/friends';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendPage } from './FriendPage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const NOW = new Date(2026, 9, 28, 20).getTime();
const share = vi.fn();
const writeText = vi.fn();

beforeEach(async () => {
  await resetDb();
  await saveProfileName('たろう');
  const workouts = [wk(new Date(2026, 9, 27, 18), [entry(sq.id, [set({ weight: 100, reps: 5 })])], { id: 'aaaaaaaa-1', name: 'LEG' })];
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq], workouts }, NOW), NOW);
  share.mockReset().mockResolvedValue(undefined);
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

const open = () => renderRoute('/friends/friend000001', '/friends/:id', <FriendPage />);
const write = async (button: string, text: string) => {
  await userEvent.click(await screen.findByRole('button', { name: button }));
  const dlg = screen.getByRole('dialog', { name: 'コメント' });
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'コメント' }), text);
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
};
const sendButton = async (n: number) => {
  const b = await screen.findByRole('button', { name: `フィードバックを送る（${n}件）` });
  await waitFor(() => expect(b).toBeEnabled());
  return b;
};

test('種目と週にコメントを書くと、その場所に「あなた: …（未送信）」', async () => {
  open();
  await write('スクワットにコメント', '5kg上がってる！');
  expect(await screen.findByRole('button', { name: 'あなた: 5kg上がってる！（未送信）' })).toBeInTheDocument();
  await write('この週にコメント', '今週もおつかれ');
  expect(await screen.findByRole('button', { name: 'あなた: 今週もおつかれ（未送信）' })).toBeInTheDocument();
  const out = await listFeedbackOut('friend000001');
  expect(out.map((f) => [f.workoutId, f.exerciseId, f.week])).toEqual([
    ['friend000001:aaaaaaaa', 'friend000001:sq-uuid-', null],
    [null, null, '2026-10-26'],
  ]);
});

test('下書きを編集・削除できる', async () => {
  open();
  await write('この日にコメント', 'いい日');
  await userEvent.click(await screen.findByRole('button', { name: 'あなた: いい日（未送信）' }));
  const dlg = screen.getByRole('dialog', { name: 'コメント' });
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'コメント' }), '！');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('button', { name: 'あなた: いい日！（未送信）' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'あなた: いい日！（未送信）' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: 'コメント' })).getByRole('button', { name: '削除' }));
  await waitFor(() => expect(screen.queryByText(/いい日/)).toBeNull());
  expect(screen.queryByRole('button', { name: /フィードバックを送る/ })).toBeNull();
});

test('空や301文字では保存できない', async () => {
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'この日にコメント' }));
  const dlg = screen.getByRole('dialog', { name: 'コメント' });
  expect(within(dlg).getByRole('button', { name: '保存' })).toBeDisabled();
  fireEvent.change(within(dlg).getByRole('textbox', { name: 'コメント' }), { target: { value: 'あ'.repeat(301) } });
  expect(within(dlg).getByRole('button', { name: '保存' })).toBeDisabled();
});

test('送るとタップ中に共有画面が出て、送信済みになる', async () => {
  open();
  await write('この日にコメント', 'いい日');
  fireEvent.click(await sendButton(1));
  expect(share).toHaveBeenCalledTimes(1);
  expect((share.mock.calls[0][0] as { text: string }).text).toMatch(/キントレ部 のフィードバックです（1件）[\s\S]*#\/friends\/add\?d=f1/);
  expect(await screen.findByRole('button', { name: 'あなた: いい日（送信済み）' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /フィードバックを送る/ })).toBeNull();
});

test('キャンセルすると未送信のまま', async () => {
  share.mockRejectedValue(new DOMException('cancel', 'AbortError'));
  open();
  await write('この日にコメント', 'いい日');
  fireEvent.click(await sendButton(1));
  await waitFor(() => expect(share).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));
  expect((await listFeedbackOut('friend000001'))[0].sentAt).toBeNull();
});

test('共有が無い端末ではコピーして送信済み', async () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  open();
  await write('この日にコメント', 'いい日');
  fireEvent.click(await sendButton(1));
  expect(await screen.findByText('コピーしました。LINE に貼り付けて送ってください')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'あなた: いい日（送信済み）' })).toBeInTheDocument();
});

test('共有画面が開いている間にもう一度押しても、送信済みにならない', async () => {
  share.mockReturnValue(new Promise(() => {}));
  open();
  await write('この日にコメント', 'いい日');
  const b = await sendButton(1);
  fireEvent.click(b);
  fireEvent.click(b);
  await new Promise((r) => setTimeout(r, 50));
  expect(share).toHaveBeenCalledTimes(1);
  expect(writeText).not.toHaveBeenCalled();
  expect((await listFeedbackOut('friend000001'))[0].sentAt).toBeNull();
});

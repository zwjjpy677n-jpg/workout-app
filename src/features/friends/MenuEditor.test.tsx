import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { saveImportedShare, saveProfileName } from '../../db/friends';
import { listMenuLog, logSentMenu } from '../../db/menus';
import { addExercise } from '../../db/repository';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { FriendPage } from './FriendPage';
import { MenuEditorPage } from './MenuEditorPage';

const sq = ex('sq-uuid-000001', { name: 'スクワット', bodyPart: 'legs' });
const NOW = new Date(2026, 9, 28, 20).getTime();
const share = vi.fn();

beforeEach(async () => {
  await resetDb();
  await saveProfileName('たろう');
  await addExercise({ name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 180, barKg: 20 });
  await addExercise({ name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 180, barKg: 20 });
  const workouts = [wk(new Date(2026, 9, 27, 18), [entry(sq.id, [set({ weight: 100, reps: 5 })])], { id: 'aaaaaaaa-1' })];
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [sq], routines: [], workouts }, NOW), NOW);
  share.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
});

const open = () => renderRoute('/friends/friend000001/menu/new', '/friends/:id/menu/new', <MenuEditorPage />);
const addFromList = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }));
  const dlg = screen.getByRole('dialog', { name: '種目を追加' });
  await userEvent.click(within(dlg).getByRole('button', { name }));
};

test('種目は友達と自分の種目を合わせた一覧（同じ名前は1つ）', async () => {
  open();
  await userEvent.click(await screen.findByRole('button', { name: '＋ 種目を追加' }));
  const dlg = screen.getByRole('dialog', { name: '種目を追加' });
  expect(within(dlg).getAllByRole('button', { name: /^(スクワット|ベンチプレス)$/ }).map((b) => b.textContent)).toEqual(['スクワット', 'ベンチプレス']);
});

test('名前・曜日・種目を入れ、レストを−/＋で変えて送ると、タップ中に共有画面が出て送信履歴に入る', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'じろうさんに送るメニュー' })).toBeInTheDocument();
  const send = screen.getByRole('button', { name: '送る' });
  expect(send).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'メニュー名' }), 'PUSH');
  await userEvent.click(screen.getByRole('button', { name: '月' }));
  expect(send).toBeDisabled();
  await addFromList('ベンチプレス');
  const item = screen.getByRole('group', { name: 'ベンチプレス' });
  expect(within(item).getByLabelText('レスト')).toHaveTextContent('1:30');
  await userEvent.click(within(item).getByRole('button', { name: 'レストを減らす' }));
  expect(within(item).getByLabelText('レスト')).toHaveTextContent('1:15');
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  expect(share).toHaveBeenCalledTimes(1);
  expect((share.mock.calls[0][0] as { text: string }).text).toMatch(/GRIND のメニュー『PUSH（月）』です[\s\S]*#\/friends\/add\?d=m1/);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001');
  const [log] = await listMenuLog('sent', 'friend000001');
  expect(log.menu).toMatchObject({ name: 'PUSH', weekday: 1, to: 'friend000001', items: [['ベンチプレス', 0, 0, 75, 3, '10', 0, 2.5, '']] });
});

test('新しい種目を作って入れられる', async () => {
  open();
  await userEvent.type(await screen.findByRole('textbox', { name: 'メニュー名' }), 'JUMP');
  await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }));
  const dlg = screen.getByRole('dialog', { name: '種目を追加' });
  await userEvent.type(within(dlg).getByRole('textbox', { name: '新しい種目の名前' }), 'ボックスジャンプ');
  await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: '部位' }), 'legs');
  await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'タイプ' }), 'bodyweight');
  await userEvent.click(within(dlg).getByRole('button', { name: '追加' }));
  expect(screen.getByRole('group', { name: 'ボックスジャンプ' })).toBeInTheDocument();
  const send = screen.getByRole('button', { name: '送る' });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  await screen.findByTestId('location');
  expect((await listMenuLog('sent'))[0].menu.items[0].slice(0, 3)).toEqual(['ボックスジャンプ', 4, 1]);
});

test('キャンセルすると送信履歴に入らない', async () => {
  share.mockRejectedValue(new DOMException('cancel', 'AbortError'));
  open();
  await userEvent.type(await screen.findByRole('textbox', { name: 'メニュー名' }), 'PUSH');
  await addFromList('ベンチプレス');
  const send = screen.getByRole('button', { name: '送る' });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  await waitFor(() => expect(share).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));
  expect(await listMenuLog('sent')).toEqual([]);
  expect(screen.queryByTestId('location')).toBeNull();
});

test('友達のメニュータブに「メニューを組んで送る」と送ったメニューの履歴', async () => {
  const { buildMenuLink } = await import('../../lib/share/menuPayload');
  const { payload } = await buildMenuLink({ id: 'meeeeeeeeeee', name: 'たろう' }, 'friend000001', { name: 'PUSH', weekday: 1, items: [{ name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 75, sets: 3, reps: '5', main: true, inc: 2.5, note: '' }] }, NOW);
  await logSentMenu({ id: 'friend000001', name: 'じろう' }, payload, NOW);
  renderRoute('/friends/friend000001', '/friends/:id', <FriendPage />);
  await userEvent.click(await screen.findByRole('tab', { name: 'メニュー' }));
  const hist = await screen.findByRole('region', { name: '送ったメニュー' });
  const row = within(hist).getByRole('button', { name: /PUSH（月）/ });
  expect(row).toHaveTextContent('10/28');
  expect(row).toHaveTextContent('1種目');
  await userEvent.click(row);
  const dlg = screen.getByRole('dialog', { name: 'PUSH（月）' });
  expect(within(dlg).getByText('3セット×5 ・ レスト 1:15')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: '閉じる' }));
  await userEvent.click(screen.getByRole('button', { name: 'メニューを組んで送る' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001/menu/new');
});

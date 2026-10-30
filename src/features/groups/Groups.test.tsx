import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { setApiForTest } from '../../lib/online/api';
import { createFakeApi, type FakeApi } from '../../lib/online/fakeApi';
import { setSession } from '../../lib/online/prefs';
import type { SharedWorkout } from '../../lib/online/types';
import { renderRoute } from '../../test/render';
import { FriendsPage } from '../friends/FriendsPage';
import { JoinPage } from '../friends/JoinPage';
import { sendText } from '../friends/useShareMine';
import { GroupPage } from './GroupPage';

vi.mock('../friends/useShareMine', async (orig) => ({ ...(await orig<typeof import('../friends/useShareMine')>()), sendText: vi.fn().mockResolvedValue('shared') }));

let api: FakeApi;
const T = new Date(2026, 9, 29, 18, 30).getTime();
const workout = (id: string, name = '脚の日'): SharedWorkout => ({
  id, name, startedAt: T, endedAt: T + 62 * 60000,
  body: { e: [['sq000000', 'スクワット', 2, 0, [[100, 5, null, null], [100, 5, null, null]]]] },
});

/** a（たろう）が作った「朝練」に b（はなこ）が入っている。端末は b */
async function setup() {
  api.as('a');
  await api.saveMyName('たろう');
  const g = await api.createGroup('朝練');
  const code = await api.createGroupInvite(g.id);
  api.now = T + 3 * 60 * 60000;
  await api.upsertWorkout(workout('wa'));
  api.as('b');
  await api.saveMyName('はなこ');
  await api.acceptInvite(code);
  setSession({ userId: 'b' });
  localStorage.setItem('ironlog:sharedHistoryAsked:b', '1');
  return g;
}
const group = (id: string) => renderRoute(`/friends/groups/${id}`, '/friends/groups/:id', <GroupPage />);

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  sessionStorage.clear();
  api = createFakeApi();
  setApiForTest(api);
  vi.mocked(sendText).mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T + 3 * 60 * 60000);
});
afterEach(() => {
  vi.useRealTimers();
  setApiForTest(null);
  localStorage.clear();
});

test('友達タブで入っているグループが見え、グループを作るとその画面へ', async () => {
  await setup();
  renderRoute('/friends', '/friends', <FriendsPage />);
  const sec = await screen.findByRole('region', { name: 'グループ' });
  expect(await within(sec).findByRole('button', { name: /朝練/ })).toBeInTheDocument();
  await userEvent.click(within(sec).getByRole('button', { name: 'グループを作る' }));
  const dlg = screen.getByRole('dialog', { name: 'グループを作る' });
  const make = within(dlg).getByRole('button', { name: '作る' });
  expect(make).toBeDisabled();
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'グループの名前' }), ' 夜練 ');
  await userEvent.click(make);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/groups/g2');
  expect((await api.listGroups()).map((g) => g.name)).toEqual(['朝練', '夜練']);
});

test('グループの画面：メンバーの記録が並び、メンバーと招待リンクが出る', async () => {
  const g = await setup();
  group(g.id);
  expect(await screen.findByRole('heading', { name: '朝練' })).toBeInTheDocument();
  expect(screen.getByText('たろう ・ 脚の日 ・ 62分 ・ 10/29 18:30')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'メンバー 2人' }));
  const dlg = screen.getByRole('dialog', { name: 'メンバー' });
  expect(within(dlg).getByText('たろう')).toBeInTheDocument();
  expect(within(dlg).getByText('（作った人）')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: '閉じる' }));
  const inv = screen.getByRole('button', { name: 'メンバーを招待' });
  await waitFor(() => expect(inv).toBeEnabled());
  await userEvent.click(inv);
  const text = vi.mocked(sendText).mock.calls[0][0];
  expect(text).toContain('キントレ部のグループ「朝練」に入ろう！');
  expect(text).toMatch(/#\/join\?c=[\w-]+&g=g1$/);
  // 名前を変えられるのは作った人だけ
  expect(screen.queryByRole('button', { name: 'グループの名前を変える' })).toBeNull();
});

test('記録を開くと中身が見え、リアクションとコメントを付けたり消したりできる', async () => {
  const g = await setup();
  group(g.id);
  await userEvent.click(await screen.findByText('たろう ・ 脚の日 ・ 62分 ・ 10/29 18:30'));
  const dlg = screen.getByRole('dialog', { name: 'たろう ・ 脚の日 ・ 62分 ・ 10/29 18:30' });
  expect(within(dlg).getByText('スクワット')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: '💪 0' }));
  await waitFor(() => expect(within(dlg).getByRole('button', { name: '💪 1' })).toHaveAttribute('aria-pressed', 'true'));
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'コメントを書く' }), 'ナイス！');
  await userEvent.click(within(dlg).getByRole('button', { name: 'コメントする' }));
  expect(await within(dlg).findByText('ナイス！')).toBeInTheDocument();
  expect(within(dlg).getByRole('textbox', { name: 'コメントを書く' })).toHaveValue('');
  // ほかのメンバーにも見える
  api.as('a');
  expect(await api.listReactions([{ owner: 'a', id: 'wa' }])).toEqual([{ owner: 'a', id: 'wa', userId: 'b', emoji: '💪' }]);
  expect((await api.listComments([{ owner: 'a', id: 'wa' }])).map((c) => c.body)).toEqual(['ナイス！']);
  api.as('b');
  // 一覧にも数が出る
  await userEvent.click(within(dlg).getByRole('button', { name: '閉じる' }));
  expect(screen.getByText('💪1')).toBeInTheDocument();
  expect(screen.getByText('💬1')).toBeInTheDocument();
  // 外す・消す
  await userEvent.click(screen.getByText('たろう ・ 脚の日 ・ 62分 ・ 10/29 18:30'));
  const again = screen.getByRole('dialog', { name: /脚の日/ });
  await userEvent.click(within(again).getByRole('button', { name: '💪 1' }));
  await waitFor(() => expect(within(again).getByRole('button', { name: '💪 0' })).toHaveAttribute('aria-pressed', 'false'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.click(within(again).getByRole('button', { name: '自分のコメントを削除' }));
  await waitFor(() => expect(within(again).queryByText('ナイス！')).toBeNull());
  vi.mocked(window.confirm).mockRestore();
});

test('作った人は名前を変えられる', async () => {
  const g = await setup();
  setSession({ userId: 'a' });
  api.as('a');
  group(g.id);
  await userEvent.click(await screen.findByRole('button', { name: 'グループの名前を変える' }));
  const dlg = screen.getByRole('dialog', { name: 'グループの名前' });
  const box = within(dlg).getByRole('textbox', { name: 'グループの名前' });
  await userEvent.clear(box);
  await userEvent.type(box, '夜練');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('heading', { name: '夜練' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('グループを抜けると友達タブへ戻り、もう見えない', async () => {
  const g = await setup();
  group(g.id);
  await screen.findByRole('heading', { name: '朝練' });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.click(screen.getByRole('button', { name: 'グループを抜ける' }));
  expect(confirm).toHaveBeenCalledWith('グループ「朝練」を抜けますか？');
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends');
  expect(await api.listGroups()).toEqual([]);
  confirm.mockRestore();
});

test('つながらないときは、そう出してもう一度を出す', async () => {
  const g = await setup();
  api.offline = true;
  group(g.id);
  expect(await screen.findByRole('alert')).toHaveTextContent('今はつながりません');
  api.offline = false;
  await userEvent.click(screen.getByRole('button', { name: 'もう一度' }));
  expect(await screen.findByRole('heading', { name: '朝練' })).toBeInTheDocument();
});

test('グループの招待リンクを開くとグループに入り、その画面へ（友達にはならない）', async () => {
  api.as('a');
  await api.saveMyName('たろう');
  const g = await api.createGroup('朝練');
  const code = await api.createGroupInvite(g.id);
  api.as('b');
  await api.saveMyName('はなこ');
  setSession({ userId: 'b' });
  renderRoute(`/join?c=${code}&g=${g.id}`, '/join', <JoinPage />);
  expect(screen.getByRole('heading', { name: 'グループの招待' })).toBeInTheDocument();
  expect(await screen.findByTestId('location')).toHaveTextContent(`/friends/groups/${g.id}`);
  expect((await api.listGroups()).map((x) => x.name)).toEqual(['朝練']);
  expect(await api.listFriends()).toEqual([]);
});

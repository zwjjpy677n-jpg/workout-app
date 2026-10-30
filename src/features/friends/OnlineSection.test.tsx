import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from '../../components/TabBar';
import { db, resetDb } from '../../db/db';
import { saveImportedShare } from '../../db/friends';
import { listExercises, listWorkouts, saveWorkout } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { setApiForTest } from '../../lib/online/api';
import { startOnlineSync } from '../../lib/online/auth';
import { createFakeApi, type FakeApi } from '../../lib/online/fakeApi';
import { getSession, setSession } from '../../lib/online/prefs';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, set, wk } from '../../test/factories';
import { renderRoute, ROUTER_FUTURE } from '../../test/render';
import { FriendPage } from './FriendPage';
import { FriendsPage } from './FriendsPage';
import { sendText } from './useShareMine';

vi.mock('./useShareMine', async (orig) => ({ ...(await orig<typeof import('./useShareMine')>()), sendText: vi.fn().mockResolvedValue('shared') }));

let api: FakeApi;
const page = () => renderRoute('/friends', '/friends', <FriendsPage />);

async function login(email = 'a@x.com', code = '123456') {
  await userEvent.type(await screen.findByLabelText('メールアドレス'), email);
  await userEvent.click(screen.getByRole('button', { name: 'コードを送る' }));
  await userEvent.type(await screen.findByLabelText('6桁のコード'), code);
  await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
}

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
  localStorage.clear();
  api = createFakeApi();
  setApiForTest(api);
  vi.mocked(sendText).mockClear();
});
afterEach(() => setApiForTest(null));

test('未設定なら出ない', () => {
  setApiForTest(null);
  page();
  expect(screen.queryByText('オンラインでつながる')).toBeNull();
});

test('コードを送ってログインし、名前を決める', async () => {
  page();
  expect(screen.getByRole('heading', { name: 'オンラインでつながる' })).toBeInTheDocument();
  await login();
  await userEvent.type(await screen.findByLabelText('表示名'), 'たろう');
  expect(screen.queryByRole('button', { name: '友達を招待' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('直近8週間の記録を共有しますか？')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'いいえ' }));
  expect(await screen.findByRole('button', { name: '友達を招待' })).toBeInTheDocument();
  expect(await api.getMyName()).toBe('たろう');
  expect(getSession()).toEqual({ userId: 'u-a@x.com' });
});

test('名前がすでにあれば名前は聞かない', async () => {
  api.as('u-a@x.com');
  await api.saveMyName('たろう');
  page();
  await login();
  expect(await screen.findByText('直近8週間の記録を共有しますか？')).toBeInTheDocument();
  expect(screen.queryByLabelText('表示名')).toBeNull();
});

test('コードが違うと「コードが違うか、期限が切れています」', async () => {
  page();
  await login('a@x.com', '000000');
  expect(await screen.findByRole('alert')).toHaveTextContent('コードが違うか、期限が切れています');
  expect(getSession()).toBeNull();
});

describe('初回の確認', () => {
  beforeEach(async () => {
    const bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!;
    await saveWorkout(wk(Date.now() - 86400_000, [entry(bench.id, [set({ weight: 80, reps: 8 })])]));
  });
  /** 別のユーザーを友達にして、サーバー上の a の記録を見る */
  const serverRows = async () => {
    api.as('u-a@x.com');
    const code = await api.createInvite();
    api.as('u-b@x.com');
    await api.saveMyName('い');
    await api.acceptInvite(code);
    const rows = await api.pullWorkouts('');
    api.as('u-a@x.com');
    return rows;
  };
  const toPrompt = async () => {
    page();
    await login();
    await userEvent.type(await screen.findByLabelText('表示名'), 'たろう');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByText('直近8週間の記録を共有しますか？');
  };

  test('「はい」なら直近の記録が送られる', async () => {
    const n = (await listWorkouts()).length;
    expect(n).toBeGreaterThan(0);
    await toPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'はい' }));
    // 記録を箱に入れ終わってから「答えた」と残すので、待ってから確かめる
    await waitFor(() => expect(localStorage.getItem('ironlog:sharedHistoryAsked:u-a@x.com')).not.toBeNull());
    await waitFor(async () => expect((await serverRows()).length).toBe(n));
  });

  test('「いいえ」なら送られず、もう聞かれない', async () => {
    await toPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'いいえ' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '友達を招待' })).toBeInTheDocument());
    expect(await db.outbox.count()).toBe(0);
    expect(await serverRows()).toEqual([]);
  });
});

test('招待リンクを共有する', async () => {
  api.as('a');
  await api.saveMyName('あ');
  setSession({ userId: 'a' });
  localStorage.setItem('ironlog:sharedHistoryAsked:a', '1');
  page();
  const b = await screen.findByRole('button', { name: '友達を招待' });
  await waitFor(() => expect(b).toBeEnabled());
  await userEvent.click(b);
  expect(sendText).toHaveBeenCalledTimes(1);
  const text = vi.mocked(sendText).mock.calls[0][0];
  expect(text).toMatch(/^キントレ部で友達になろう！ このリンクを開いてね\nhttps?:\/\/.*#\/join\?c=[\w-]+$/);
});

test('つながらないときの表示', async () => {
  api.as('a');
  setSession({ userId: 'a' });
  api.offline = true;
  page();
  expect(await screen.findByRole('status')).toHaveTextContent('今はつながりません。あとで自動で送ります');
});

test('ログインの期限が切れていたらログイン画面に戻る', async () => {
  setSession({ userId: 'a' }); // サーバー側は未ログイン
  page();
  expect(await screen.findByLabelText('メールアドレス')).toBeInTheDocument();
  expect(getSession()).toBeNull();
});

async function seedFriends() {
  const b = ex('fb-uuid-00001', { name: 'スクワット' });
  const at = Date.now() - 3600_000;
  for (const id of ['link000001', 'online00001']) {
    await saveImportedShare(buildSharePayload({ profile: { id, name: 'じろう' }, exercises: [b], workouts: [wk(at, [entry(b.id, [set({ weight: 100, reps: 5 })])])] }, at + 1000), Date.now());
  }
  await db.friendWorkouts.toCollection().modify({ receivedAt: Date.now() });
  await db.friends.update('online00001', { online: { userId: 'online00001' } });
}

test('リンクの友達とオンラインの友達が同じ名前でも 2 行並び、オンラインの行に「オンライン」が付く', async () => {
  await seedFriends();
  page();
  const rows = await screen.findAllByRole('button', { name: /じろう/ });
  expect(rows).toHaveLength(2);
  expect(rows.filter((r) => r.textContent?.includes('オンライン'))).toHaveLength(1);
});

test('未読の点が友達の行に付き、タブを開くと消える', async () => {
  await seedFriends();
  await db.sync.put({ key: 'seenAt', value: 0 });
  // ログインしていない間は見たことにならない
  const first = page();
  const row = (await screen.findAllByRole('button', { name: /じろう/ }))[0];
  expect(await screen.findAllByRole('img', { name: '未読' })).not.toHaveLength(0);
  expect(row).toBeTruthy();
  first.unmount();
  // 下のタブにも点
  const tabs = render(<MemoryRouter future={ROUTER_FUTURE}><TabBar /></MemoryRouter>);
  expect(await screen.findByRole('img', { name: '未読あり' })).toBeInTheDocument();
  tabs.unmount();
  // ログインして開くと既読になる
  api.as('me');
  setSession({ userId: 'me' });
  page();
  await waitFor(() => expect(screen.queryAllByRole('img', { name: '未読' })).toHaveLength(0));
});

test('同期の開始は2回呼んでも登録は1回', () => {
  const add = vi.spyOn(window, 'addEventListener');
  startOnlineSync();
  startOnlineSync();
  expect(add.mock.calls.filter((c) => c[0] === 'online').length).toBeLessThanOrEqual(1);
  add.mockRestore();
});

test('オンラインの友達には「この友達を削除」を出さない', async () => {
  await seedFriends();
  const { unmount } = renderRoute('/friends/online00001', '/friends/:id', <FriendPage />);
  await screen.findByRole('heading', { name: 'じろう' });
  expect(screen.queryByRole('button', { name: 'この友達を削除' })).toBeNull();
  unmount();
  renderRoute('/friends/link000001', '/friends/:id', <FriendPage />);
  expect(await screen.findByRole('button', { name: 'この友達を削除' })).toBeInTheDocument();
});

test('名前を決める前にやめたら、開き直しても名前から（招待は作らない）', async () => {
  const spy = vi.spyOn(api, 'createInvite');
  const first = page();
  await login();
  await screen.findByLabelText('表示名');
  first.unmount();
  page();
  expect(await screen.findByLabelText('表示名')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '友達を招待' })).toBeNull();
  expect(spy).not.toHaveBeenCalled();
});

test('確認に答える前にやめたら、開き直したときまた聞く（それまで招待は作らない）', async () => {
  const spy = vi.spyOn(api, 'createInvite');
  const first = page();
  await login();
  await userEvent.type(await screen.findByLabelText('表示名'), 'たろう');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await screen.findByText('直近8週間の記録を共有しますか？');
  first.unmount();
  page();
  expect(await screen.findByText('直近8週間の記録を共有しますか？')).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalled();
});

test('「はい」の送信が失敗したら、つながらない表示を出し、確認は済みにしない', async () => {
  api.as('a');
  await api.saveMyName('あ');
  setSession({ userId: 'a' });
  const outbox = await import('../../lib/online/outbox');
  const spy = vi.spyOn(outbox, 'queueRecentWorkouts').mockRejectedValueOnce(new Error('db'));
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'はい' }));
  expect(await screen.findByRole('status')).toHaveTextContent('今はつながりません。あとで自動で送ります');
  expect(screen.getByText('直近8週間の記録を共有しますか？')).toBeInTheDocument();
  expect(localStorage.getItem('ironlog:sharedHistoryAsked:a')).toBeNull();
  spy.mockRestore();
});

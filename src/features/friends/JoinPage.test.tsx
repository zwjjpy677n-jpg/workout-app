import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { setApiForTest } from '../../lib/online/api';
import { createFakeApi, type FakeApi } from '../../lib/online/fakeApi';
import { getSession, setSession } from '../../lib/online/prefs';
import { OnlineError } from '../../lib/online/types';
import { renderRoute } from '../../test/render';
import { JoinPage } from './JoinPage';

let api: FakeApi;
const open = (code: string | null) => renderRoute(code === null ? '/join' : `/join?c=${code}`, '/join', <JoinPage />);
const USED = 'このリンクはもう使えません。もう一度送ってもらってください';

async function invite(): Promise<string> {
  api.as('owner');
  await api.saveMyName('たろう');
  return api.createInvite();
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  sessionStorage.clear();
  api = createFakeApi();
  setApiForTest(api);
});
afterEach(() => setApiForTest(null));

test('ログイン済みなら友達になって、その友達の画面へ', async () => {
  const code = await invite();
  api.as('guest');
  await api.saveMyName('はなこ');
  setSession({ userId: 'guest' });
  open(code);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/owner');
  expect((await api.listFriends()).map((f) => f.userId)).toEqual(['owner']);
  expect(sessionStorage.getItem('ironlog:pendingInvite')).toBeNull();
});

test('未ログインならログインのあとで友達になる', async () => {
  const code = await invite();
  open(code);
  expect(sessionStorage.getItem('ironlog:pendingInvite')).toBe(code);
  await userEvent.type(await screen.findByLabelText('メールアドレス'), 'g@x.com');
  await userEvent.click(screen.getByRole('button', { name: 'コードを送る' }));
  await userEvent.type(await screen.findByLabelText('確認コード'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
  await userEvent.type(await screen.findByLabelText('表示名'), 'はなこ');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/owner');
  expect(sessionStorage.getItem('ironlog:pendingInvite')).toBeNull();
});

test('ログイン済みでも名前が無ければ、先に名前を決める', async () => {
  const code = await invite();
  api.as('guest');
  setSession({ userId: 'guest' });
  open(code);
  await userEvent.type(await screen.findByLabelText('表示名'), 'はなこ');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/owner');
});

test('使用済み・期限切れ・でたらめは「このリンクはもう使えません。もう一度送ってもらってください」', async () => {
  const code = await invite();
  api.as('other');
  await api.saveMyName('じろう');
  await api.acceptInvite(code); // 使用済みにする
  api.as('guest');
  await api.saveMyName('はなこ');
  setSession({ userId: 'guest' });
  const a = open(code);
  expect(await screen.findByText(USED)).toBeInTheDocument();
  expect(sessionStorage.getItem('ironlog:pendingInvite')).toBeNull();
  a.unmount();

  api.as('owner');
  const old = await api.createInvite();
  api.now += 8 * 24 * 60 * 60 * 1000;
  api.as('guest');
  const b = open(old);
  expect(await screen.findByText(USED)).toBeInTheDocument();
  b.unmount();

  open('でたらめ');
  expect(await screen.findByText(USED)).toBeInTheDocument();
});

test('コードが無いリンクも使えない扱い', async () => {
  api.as('guest');
  await api.saveMyName('はなこ');
  setSession({ userId: 'guest' });
  open(null);
  expect(await screen.findByText(USED)).toBeInTheDocument();
});

test('自分のリンクは「自分の招待リンクです」', async () => {
  const code = await invite();
  setSession({ userId: 'owner' });
  open(code);
  expect(await screen.findByText('自分の招待リンクです')).toBeInTheDocument();
});

test('オンライン未設定なら「この版ではオンライン機能が使えません」', async () => {
  setApiForTest(null);
  open('abc');
  expect(await screen.findByText('この版ではオンライン機能が使えません')).toBeInTheDocument();
});

test('つながらないときは「もう一度」で試し直せる', async () => {
  const code = await invite();
  api.as('guest');
  await api.saveMyName('はなこ');
  setSession({ userId: 'guest' });
  api.offline = true;
  open(code);
  expect(await screen.findByText('今はつながりません。あとで自動で送ります')).toBeInTheDocument();
  expect(sessionStorage.getItem('ironlog:pendingInvite')).toBe(code);
  api.offline = false;
  await userEvent.click(screen.getByRole('button', { name: 'もう一度' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/owner');
});

test('ログインが切れていたらログイン画面を出す', async () => {
  const code = await invite();
  api.as('guest');
  setSession({ userId: 'guest' });
  // 端末は「ログイン済み」だが、サーバー側では本人が確認できない
  vi.spyOn(api, 'getMyName').mockRejectedValue(new OnlineError('auth'));
  open(code);
  expect(await screen.findByLabelText('メールアドレス')).toBeInTheDocument();
  expect(getSession()).toBeNull();
});

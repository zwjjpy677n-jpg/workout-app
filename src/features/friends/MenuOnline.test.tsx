import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, resetDb } from '../../db/db';
import { saveProfileName } from '../../db/friends';
import { listMenuLog } from '../../db/menus';
import { addExercise, listRoutines, saveRoutine } from '../../db/repository';
import { setApiForTest } from '../../lib/online/api';
import { createFakeApi, type FakeApi } from '../../lib/online/fakeApi';
import { flushOutbox } from '../../lib/online/outbox';
import { pullAll } from '../../lib/online/pull';
import { setSession } from '../../lib/online/prefs';
import { saveImportedShare } from '../../db/friends';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { renderRoute } from '../../test/render';
import { FriendsPage } from './FriendsPage';
import { MenuEditorPage } from './MenuEditorPage';

let api: FakeApi;

/** a と b は友達。a の端末として始める */
beforeEach(async () => {
  localStorage.clear();
  await resetDb();
  api = createFakeApi();
  setApiForTest(api);
  api.as('a');
  await api.saveMyName('あきら');
  const code = await api.createInvite();
  api.as('b');
  await api.saveMyName('べん');
  await api.acceptInvite(code);
  api.as('a');
  setSession({ userId: 'a' });
  await saveProfileName('あきら');
  await pullAll(1000);
  await addExercise({ name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 180, barKg: 20 });
});
afterEach(() => {
  setApiForTest(null);
  localStorage.clear();
});

/** 端末を b に替える */
async function switchToB() {
  await resetDb();
  api.as('b');
  setSession({ userId: 'b' });
  await saveProfileName('べん');
  await pullAll(2000);
}

const editor = () => renderRoute('/friends/b/menu/new', '/friends/:id/menu/new', <MenuEditorPage />);
const friendsPage = () => renderRoute('/friends', '/friends', <FriendsPage />);

async function buildAndSend(button: string) {
  editor();
  await screen.findByRole('heading', { name: 'べんさんに送るメニュー' });
  await userEvent.type(screen.getByRole('textbox', { name: 'メニュー名' }), 'PUSH');
  await userEvent.click(screen.getByRole('button', { name: '＋ 種目を追加' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: '種目を追加' })).getByRole('button', { name: 'ベンチプレス' }));
  await userEvent.click(screen.getByRole('button', { name: button }));
}

test('オンラインの友達に組んだメニューをアプリで送ると、相手の届いたメニューに出て、自分の送信履歴に入る', async () => {
  await buildAndSend('アプリで送る');
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/b');
  const [log] = await listMenuLog('sent', 'b');
  expect(log.menu.name).toBe('PUSH');
  expect(await db.outbox.count()).toBe(0);

  await switchToB();
  friendsPage();
  expect(await screen.findByRole('heading', { name: '届いたメニュー' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'あきらさんからのメニュー『PUSH』' })).toBeInTheDocument();
});

test('届いたメニューを「追加する」と自分のルーティンに入り、届いたメニューから消える', async () => {
  await buildAndSend('アプリで送る');
  await screen.findByTestId('location');
  await switchToB();
  friendsPage();
  await userEvent.click(await screen.findByRole('button', { name: '追加する' }));
  await waitFor(async () => expect((await listRoutines()).map((r) => r.name)).toEqual(['PUSH']));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '届いたメニュー' })).toBeNull());
  expect(await db.menuInbox.count()).toBe(0);
  expect((await listMenuLog('received'))[0]?.friendId).toBe('a');
});

test('届いたメニューは「削除」で捨てられる', async () => {
  await buildAndSend('アプリで送る');
  await screen.findByTestId('location');
  await switchToB();
  friendsPage();
  await userEvent.click(await screen.findByRole('button', { name: '削除' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '届いたメニュー' })).toBeNull());
  expect(await listRoutines()).toHaveLength(0);
});

test('自分のメニューを選んでアプリで送ると、相手の友達の画面のメニューに出る', async () => {
  const bench = (await db.exercises.toArray())[0];
  await saveRoutine({ name: 'PULL', weekday: 2, items: [{ exerciseId: bench.id, sets: 3, reps: '8', main: true, inc: 2.5, note: '', restSec: 120 }] });
  friendsPage();
  await userEvent.click(await screen.findByRole('button', { name: /共有するメニューを選ぶ/ }));
  await userEvent.click(await screen.findByRole('checkbox', { name: /PULL/ }));
  await userEvent.click(screen.getByRole('button', { name: '決定' }));
  await userEvent.click(screen.getByRole('button', { name: 'メニューをアプリで送る' }));
  expect(await screen.findByText('送りました')).toBeInTheDocument();

  await switchToB();
  const f = await db.friends.get('a');
  expect(f?.routines.map((r) => r.name)).toEqual(['PULL']);
  expect(f?.routines[0].items[0]).toMatchObject({ sets: 3, reps: '8', main: true });
});

test('リンクの友達には「アプリで送る」が出ない', async () => {
  await db.friends.delete('b');
  await saveImportedShare(buildSharePayload({ profile: { id: 'linkfriend01', name: 'リンク' }, exercises: [], workouts: [] }, 1000), 1000);
  renderRoute('/friends/linkfriend01/menu/new', '/friends/:id/menu/new', <MenuEditorPage />);
  await screen.findByRole('heading', { name: 'リンクさんに送るメニュー' });
  expect(screen.queryByRole('button', { name: 'アプリで送る' })).toBeNull();
  expect(screen.getByRole('button', { name: '送る' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'リンクで送る' })).toBeNull();
});

test('オフラインで送ると「今はつながりません。あとで自動で送ります」が出て、つながったら届く', async () => {
  api.offline = true;
  const bench = (await db.exercises.toArray())[0];
  await saveRoutine({ name: 'PULL', weekday: null, items: [{ exerciseId: bench.id, sets: 3, reps: '8', main: false, inc: 2.5, note: '', restSec: 120 }] });
  friendsPage();
  await userEvent.click(await screen.findByRole('button', { name: /共有するメニューを選ぶ/ }));
  await userEvent.click(await screen.findByRole('checkbox', { name: /PULL/ }));
  await userEvent.click(screen.getByRole('button', { name: '決定' }));
  await userEvent.click(screen.getByRole('button', { name: 'メニューをアプリで送る' }));
  expect((await screen.findAllByText('今はつながりません。あとで自動で送ります')).length).toBeGreaterThan(0);
  expect(await db.outbox.count()).toBe(1);
  api.offline = false;
  expect(await flushOutbox()).toBe('done');
  await switchToB();
  expect((await db.friends.get('a'))?.routines.map((r) => r.name)).toEqual(['PULL']);
});

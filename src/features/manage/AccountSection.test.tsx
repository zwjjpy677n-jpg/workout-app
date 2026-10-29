import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db, resetDb } from '../../db/db';
import { finishWorkout, saveWorkout } from '../../db/repository';
import { setApiForTest } from '../../lib/online/api';
import { createFakeApi, type FakeApi } from '../../lib/online/fakeApi';
import { flushOutbox } from '../../lib/online/outbox';
import { getAutoShare, getSession, setSession } from '../../lib/online/prefs';
import { entry, ex, set, wk } from '../../test/factories';
import { ROUTER_FUTURE } from '../../test/render';
import { FriendsPage } from '../friends/FriendsPage';
import { AccountSection } from './AccountSection';
import { SettingsForm } from './SettingsForm';

let api: FakeApi;

beforeEach(async () => {
  localStorage.clear();
  await resetDb();
  api = createFakeApi();
  setApiForTest(api);
  api.as('a');
  await api.saveMyName('あ');
  const code = await api.createInvite();
  api.as('b');
  await api.saveMyName('い');
  await api.acceptInvite(code);
  api.as('a');
  setSession({ userId: 'a' });
});
afterEach(() => {
  setApiForTest(null);
  localStorage.clear();
  vi.restoreAllMocks();
});

test('メールアドレスと今の表示名が出る', async () => {
  render(<AccountSection />);
  expect(await screen.findByRole('heading', { name: 'アカウント' })).toBeInTheDocument();
  expect(await screen.findByText('a@example.com')).toBeInTheDocument();
  expect(await screen.findByDisplayValue('あ')).toBeInTheDocument();
});

test('表示名を変えると相手の一覧の名前が変わる', async () => {
  render(<AccountSection />);
  const input = await screen.findByLabelText('表示名');
  await screen.findByDisplayValue('あ');
  await userEvent.clear(input);
  await userEvent.type(input, 'あきら');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('保存しました')).toBeInTheDocument();
  api.as('b');
  expect((await api.listFriends()).map((f) => f.name)).toEqual(['あきら']);
});

test('表示名が空・21文字以上なら保存できない。保存に失敗したら知らせる', async () => {
  render(<AccountSection />);
  const input = await screen.findByLabelText('表示名');
  await screen.findByDisplayValue('あ');
  await userEvent.clear(input);
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  await userEvent.type(input, 'あ'.repeat(21));
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.type(input, 'ほし');
  api.offline = true;
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
});

test('自動共有のチェックを切り替えると端末に残る', async () => {
  render(<AccountSection />);
  const box = await screen.findByRole('checkbox', { name: '自動共有' });
  expect(box).toBeChecked();
  expect(screen.getByText('トレーニングを終えると、友達に自動で表示されます')).toBeInTheDocument();
  await userEvent.click(box);
  expect(box).not.toBeChecked();
  expect(getAutoShare()).toBe(false);
});

test('自動共有をオフにすると、終了しても送られない', async () => {
  render(<AccountSection />);
  await userEvent.click(await screen.findByRole('checkbox', { name: '自動共有' }));
  await db.exercises.put(ex('bench', { name: 'ベンチ' }));
  const w = wk(Date.now() - 3600_000, [entry('bench', [set({ weight: 60, reps: 5 })])], { endedAt: null });
  await saveWorkout(w);
  expect(await finishWorkout(w.id)).toBe('saved');
  await flushOutbox();
  api.as('b');
  expect(await api.pullWorkouts('')).toEqual([]);
});

test('ログアウトするとアカウントの欄が消え、友達タブがログイン前に戻る', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<AccountSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }));
  expect(window.confirm).toHaveBeenCalledWith('ログアウトしますか？ 端末の記録は消えません');
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'アカウント' })).toBeNull());
  expect(getSession()).toBeNull();
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <FriendsPage />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText('メールアドレス')).toBeInTheDocument();
});

test('確認で取り消すとログアウトしない', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<AccountSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }));
  expect(getSession()).toEqual({ userId: 'a' });
  expect(screen.getByRole('heading', { name: 'アカウント' })).toBeInTheDocument();
});

test('設定: ログイン済みのときだけアカウントが出る', async () => {
  const { unmount } = render(<SettingsForm />);
  expect(await screen.findByRole('heading', { name: 'アカウント' })).toBeInTheDocument();
  unmount();
  setSession(null);
  render(<SettingsForm />);
  await screen.findByText('バー重量（kg）');
  expect(screen.queryByRole('heading', { name: 'アカウント' })).toBeNull();
});

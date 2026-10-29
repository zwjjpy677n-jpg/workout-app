import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { resetDb } from '../../db/db';
import { getProfile, saveImportedShare, saveProfileName } from '../../db/friends';
import { listExercises, saveRoutine, saveWorkout } from '../../db/repository';
import { ensureSeeded } from '../../db/seed';
import { TabBar } from '../../components/TabBar';
import { decodeShare, encodeShare } from '../../lib/share/codec';
import { parseSharePayload } from '../../lib/share/importShare';
import { buildSharePayload } from '../../lib/share/sharePayload';
import { entry, ex, item, set, wk } from '../../test/factories';
import { renderRoute, ROUTER_FUTURE } from '../../test/render';
import { FriendsPage } from './FriendsPage';

const page = () => renderRoute('/friends', '/friends', <FriendsPage />);
/** リンクの準備ができてから押す */
const clickShare = async () => {
  const b = await screen.findByRole('button', { name: /^自分の記録(とメニュー)?を共有$/ });
  await waitFor(() => expect(b).toBeEnabled());
  await userEvent.click(b);
};
const share = vi.fn();
const writeText = vi.fn();

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
  const bench = (await listExercises()).find((e) => e.name === 'ベンチプレス')!;
  await saveWorkout(wk(Date.now() - 86400_000, [entry(bench.id, [set({ weight: 80, reps: 8 })])]));
  share.mockReset().mockResolvedValue(undefined);
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

test('初回は名前を聞いてから共有画面を出す', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: '自分の記録を共有' }));
  const dlg = screen.getByRole('dialog', { name: '友達に表示する名前' });
  await userEvent.type(within(dlg).getByRole('textbox'), 'たろう');
  await userEvent.click(within(dlg).getByRole('button', { name: '保存' }));
  expect(share).not.toHaveBeenCalled();
  const go = await within(dlg).findByRole('button', { name: '共有する' });
  await waitFor(() => expect(go).toBeEnabled());
  await userEvent.click(go);
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const { text } = share.mock.calls[0][0] as { text: string };
  expect(text).toContain('キントレ部 の記録です');
  expect(text).toMatch(/#\/friends\/add\?d=r1/);
  expect((await getProfile())?.name).toBe('たろう');
});

test('名前は1〜20文字でないと保存できない', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: '自分の記録を共有' }));
  const dlg = screen.getByRole('dialog', { name: '友達に表示する名前' });
  expect(within(dlg).getByRole('button', { name: '保存' })).toBeDisabled();
  await userEvent.type(within(dlg).getByRole('textbox'), 'あ'.repeat(21));
  expect(within(dlg).getByRole('button', { name: '保存' })).toBeDisabled();
});

test('共有が無い端末ではコピーして知らせる', async () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  await saveProfileName('たろう');
  page();
  await clickShare();
  expect(await screen.findByText('コピーしました。LINE に貼り付けて送ってください')).toBeInTheDocument();
  expect(writeText.mock.calls[0][0]).toMatch(/#\/friends\/add\?d=r1/);
});

test('共有をキャンセルしても何も出ない', async () => {
  share.mockRejectedValue(new DOMException('cancel', 'AbortError'));
  await saveProfileName('たろう');
  page();
  await clickShare();
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('貼り付けて読み込むと確認画面へ移る、壊れたリンクは「読み込めないリンクです」', async () => {
  const data = await encodeShare('r', { x: 1 });
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'リンクを貼り付けて追加' }));
  const dlg = screen.getByRole('dialog', { name: 'リンクを貼り付けて追加' });
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'リンク' }), 'こんにちは');
  await userEvent.click(within(dlg).getByRole('button', { name: '読み込む' }));
  expect(await within(dlg).findByText('読み込めないリンクです')).toBeInTheDocument();
  await userEvent.clear(within(dlg).getByRole('textbox', { name: 'リンク' }));
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'リンク' }), `キントレ部 の記録です\nhttps://x/#/friends/add?d=${data}`);
  await userEvent.click(within(dlg).getByRole('button', { name: '読み込む' }));
  expect(await screen.findByTestId('location')).toHaveTextContent(`/friends/add?d=${data}`);
});

test('友達がいないときの案内と、一覧の名前・最後のトレーニング・受け取り日', async () => {
  page();
  expect(await screen.findByText('まだ友達がいません。友達に キントレ部 の記録を送ってもらって、ここに貼り付けてください')).toBeInTheDocument();
  const b = ex('fb-uuid-00001', { name: 'スクワット' });
  const at = new Date(2026, 9, 27, 18).getTime();
  await saveImportedShare(buildSharePayload({ profile: { id: 'friend000001', name: 'じろう' }, exercises: [b], workouts: [wk(at, [entry(b.id, [set({ weight: 100, reps: 5 })])])] }, at + 3600_000), new Date(2026, 9, 28, 9).getTime());
  const item = await screen.findByRole('button', { name: /じろう/ });
  expect(item).toHaveTextContent('最後のトレーニング 10/27');
  expect(item).toHaveTextContent('受け取り 10/28');
  await userEvent.click(item);
  expect(await screen.findByTestId('location')).toHaveTextContent('/friends/friend000001');
});

test('下のタブが5つで「友達」がある', () => {
  render(<MemoryRouter future={ROUTER_FUTURE}><TabBar /></MemoryRouter>);
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['ホーム', 'カレンダー', 'グラフ', '友達', '管理']);
  expect(screen.getByRole('link', { name: '友達' })).toHaveAttribute('href', '/friends');
});

test('押したその場で共有画面を出す（iPhone はタップの直後でないと出せない）', async () => {
  await saveProfileName('たろう');
  page();
  const b = await screen.findByRole('button', { name: '自分の記録を共有' });
  await waitFor(() => expect(b).toBeEnabled());
  fireEvent.click(b);
  expect(share).toHaveBeenCalledTimes(1);
});

test('削って共有するときは、ボタンの下に週数を出し、確認ダイアログは出さない（iPhone はタップ直後でないと共有できない）', async () => {
  await saveProfileName('たろう');
  const exs = await listExercises();
  for (let d = 0; d < 56; d++) {
    await saveWorkout(wk(Date.now() - d * 86400_000 - 3600_000, exs.slice(0, 12).map((e, k) => entry(e.id, Array.from({ length: 6 }, (_, s) => set({ weight: 20 + ((d * 7 + k * 3 + s) % 180), reps: 3 + ((d + s) % 10), rpe: 6 + (s % 4) })))), { id: crypto.randomUUID() }));
  }
  const confirm = vi.spyOn(window, 'confirm');
  page();
  expect(await screen.findByText(/^直近\d週ぶんを共有します$/)).toBeInTheDocument();
  const b = screen.getByRole('button', { name: '自分の記録を共有' });
  fireEvent.click(b);
  expect(share).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});

test('最初はメニューを送らず、選んだメニューだけ一緒に共有する', async () => {
  await saveProfileName('たろう');
  const exs = await listExercises();
  await saveRoutine({ name: 'PUSH', weekday: 1, items: [item(exs[0].id)] });
  await saveRoutine({ name: 'PULL', weekday: 2, items: [item(exs[1].id)] });
  page();
  const sent = async () => {
    await clickShare();
    await waitFor(() => expect(share).toHaveBeenCalled());
    const text = (share.mock.calls.at(-1)![0] as { text: string }).text;
    return parseSharePayload((await decodeShare(text)).data).r.map((r) => r[0]);
  };
  expect(await screen.findByRole('button', { name: '共有するメニューを選ぶ（0件）' })).toBeInTheDocument();
  expect(await sent()).toEqual([]);
  await userEvent.click(screen.getByRole('button', { name: '共有するメニューを選ぶ（0件）' }));
  const dlg = screen.getByRole('dialog', { name: '共有するメニュー' });
  await userEvent.click(within(dlg).getByRole('checkbox', { name: /PULL/ }));
  await userEvent.click(within(dlg).getByRole('button', { name: '決定' }));
  expect(screen.getByRole('button', { name: '共有するメニューを選ぶ（1件）' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '自分の記録とメニューを共有' })).toBeInTheDocument();
  await waitFor(async () => expect(await sent()).toEqual(['PULL']));
});

test('メニューを選んだ直後に押しても、選ぶ前のリンク（メニュー無し）を送らない', async () => {
  await saveProfileName('たろう');
  const exs = await listExercises();
  await saveRoutine({ name: 'PULL', weekday: 2, items: [item(exs[1].id)] });
  page();
  const b0 = await screen.findByRole('button', { name: '自分の記録を共有' });
  await waitFor(() => expect(b0).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: '共有するメニューを選ぶ（0件）' }));
  const dlg = screen.getByRole('dialog', { name: '共有するメニュー' });
  await userEvent.click(within(dlg).getByRole('checkbox', { name: /PULL/ }));
  await userEvent.click(within(dlg).getByRole('button', { name: '決定' }));
  fireEvent.click(screen.getByRole('button', { name: '自分の記録とメニューを共有' }));
  const b = screen.getByRole('button', { name: '自分の記録とメニューを共有' });
  await waitFor(() => expect(b).toBeEnabled());
  fireEvent.click(b);
  await waitFor(() => expect(share).toHaveBeenCalled());
  for (const [arg] of share.mock.calls) {
    const r = parseSharePayload((await decodeShare((arg as { text: string }).text)).data).r.map((x) => x[0]);
    expect(r).toEqual(['PULL']);
  }
});

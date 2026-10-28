import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDb } from '../../db/db';
import { saveProfileName } from '../../db/friends';
import { listMenuLog } from '../../db/menus';
import { addExercise, getWorkout, listExercises, listRoutines, saveRoutine, saveWorkout } from '../../db/repository';
import { encodeShare } from '../../lib/share/codec';
import type { MenuPayload } from '../../lib/share/menuPayload';
import { entry, item, set, wk } from '../../test/factories';
import { renderRoute } from '../../test/render';
import { ImportPage } from './ImportPage';

let me = { id: '', name: '' };
let benchId = '';
beforeEach(async () => {
  await resetDb();
  me = await saveProfileName('たろう');
  benchId = (await addExercise({ name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 180, barKg: 20 })).id;
});
const payload = (o: Partial<MenuPayload> = {}): MenuPayload => ({
  id: 'friend000001', n: 'じろう', to: me.id, at: 100, mid: 'menu00000001', name: 'PUSH', weekday: 1,
  items: [
    ['ベンチプレス', 0, 0, 75, 4, '5', 1, 2.5, ''],
    ['ディップス', 0, 1, 90, 3, '10', 0, 2.5, ''],
  ],
  ...o,
});
const open = async (p: MenuPayload) => renderRoute(`/friends/add?d=${await encodeShare('m', p)}`, '/friends/add', <ImportPage />);

test('無い種目は「新しく追加」と出て、追加すると種目とメニューができ管理へ', async () => {
  await open(payload());
  expect(await screen.findByText('じろうさんからのメニュー『PUSH（月）』')).toBeInTheDocument();
  const rows = screen.getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('ベンチプレス4セット×5 ・ レスト 1:15');
  expect(within(rows[0]).queryByText('新しく追加')).toBeNull();
  expect(within(rows[1]).getByText('新しく追加')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '置き換える' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: '追加する' }));
  expect(await screen.findByTestId('location')).toHaveTextContent('/manage');
  expect((await listExercises()).map((e) => e.name).sort()).toEqual(['ディップス', 'ベンチプレス']);
  expect((await listRoutines())[0]).toMatchObject({ name: 'PUSH', weekday: 1 });
});

test('同じ名前のメニューは置き換えか別に追加を選べ、置き換えても過去の記録は変わらない', async () => {
  const old = await saveRoutine({ name: 'PUSH', weekday: 3, items: [item(benchId)] });
  const done = wk(new Date(2026, 9, 20, 18), [{ ...entry(benchId, [set({ weight: 80, reps: 8 })]), target: { sets: 3, reps: '10', main: false, inc: 2.5, note: '', restSec: null } }], { routineId: old.id });
  await saveWorkout(done);
  await open(payload());
  expect(await screen.findByRole('button', { name: '別のメニューとして追加' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '置き換える' }));
  await screen.findByTestId('location');
  const rs = await listRoutines();
  expect(rs).toHaveLength(1);
  expect(rs[0]).toMatchObject({ id: old.id, weekday: 1 });
  expect(await getWorkout(done.id)).toEqual(done);
  expect((await listMenuLog('received'))[0].result).toBe('replaced');
});

test('受け取り済み・宛先違いは保存できない', async () => {
  const { unmount } = await open(payload());
  await userEvent.click(await screen.findByRole('button', { name: '追加する' }));
  await screen.findByTestId('location');
  unmount();
  const r2 = await open(payload());
  expect(await screen.findByText('このメニューは受け取り済みです')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '追加する' })).toBeNull();
  r2.unmount();
  await open(payload({ mid: 'menu00000009', to: 'someoneelse1' }));
  expect(await screen.findByText('あなた宛てではないメニューです')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '追加する' })).toBeNull();
});

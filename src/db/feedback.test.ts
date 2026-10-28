import { entry, set, wk } from '../test/factories';
import type { FeedbackPayload } from '../lib/share/feedbackPayload';
import { resetDb } from './db';
import { deleteDraft, feedbackForWorkouts, importFeedback, listFeedbackOut, listInbox, markRead, markSent, previewFeedback, saveDraft } from './feedback';
import { saveProfileName } from './friends';
import { addExercise, saveWorkout } from './repository';

beforeEach(() => resetDb());

test('下書き → 編集 → 削除、送信済みは一覧に残る', async () => {
  const a = await saveDraft({ friendId: 'f1', workoutId: 'f1:aaaaaaaa', week: null, exerciseId: null, text: 'いいね' });
  expect(a.id).toMatch(/^[A-Za-z0-9]{12}$/);
  await saveDraft({ ...a, text: 'すごい' });
  const b = await saveDraft({ friendId: 'f1', workoutId: null, week: '2026-10-26', exerciseId: null, text: '今週' });
  await saveDraft({ friendId: 'f2', workoutId: null, week: '2026-10-26', exerciseId: null, text: '別の友達' });
  expect((await listFeedbackOut('f1')).map((x) => [x.text, x.sentAt])).toEqual([['すごい', null], ['今週', null]]);
  await markSent([a.id], 123);
  await deleteDraft(b.id);
  expect((await listFeedbackOut('f1')).map((x) => [x.text, x.sentAt])).toEqual([['すごい', 123]]);
});

describe('届いたフィードバック', () => {
  let me = { id: '', name: '' };
  let wid = '';
  let xid = '';
  beforeEach(async () => {
    me = await saveProfileName('たろう');
    const e = await addExercise({ name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 120, barKg: 20 });
    xid = e.id;
    wid = crypto.randomUUID();
    await saveWorkout(wk(new Date(2026, 9, 27, 18), [entry(e.id, [set({ weight: 100, reps: 5 })])], { id: wid }));
  });
  const payload = (o: Partial<FeedbackPayload> = {}): FeedbackPayload => ({
    id: 'friend000001', n: 'じろう', to: me.id, at: 100,
    c: [
      ['fid000000001', wid.slice(0, 8), null, xid.slice(0, 8), '5kg上がってる！', 90],
      ['fid000000002', 'zzzzzzzz', null, null, '消えた記録へ', 91],
      ['fid000000003', null, '2026-10-26', null, '今週もおつかれ', 92],
    ],
    ...o,
  });

  test('前方一致で自分の記録・種目の ID が入り、見つからなければ null。2回貼っても増えない', async () => {
    expect(await previewFeedback(payload())).toEqual({ mine: true, count: 3, newCount: 3 });
    expect(await importFeedback(payload())).toBe(3);
    expect(await previewFeedback(payload())).toEqual({ mine: true, count: 3, newCount: 0 });
    await importFeedback(payload());
    const inbox = await listInbox();
    expect(inbox.map((f) => [f.id, f.workoutId, f.exerciseId, f.week, f.friendName, f.read, f.at])).toEqual([
      ['fid000000003', null, null, '2026-10-26', 'じろう', false, 92 * 60000],
      ['fid000000002', null, null, null, 'じろう', false, 91 * 60000],
      ['fid000000001', wid, xid, null, 'じろう', false, 90 * 60000],
    ]);
    expect((await feedbackForWorkouts([wid])).map((f) => f.id)).toEqual(['fid000000001']);
    await markRead('fid000000001');
    expect((await listInbox()).find((f) => f.id === 'fid000000001')?.read).toBe(true);
  });

  test('宛先が自分でなければ mine: false', async () => {
    expect((await previewFeedback(payload({ to: 'someoneelse1' }))).mine).toBe(false);
  });
});

test('自分に ID が無ければ mine: false', async () => {
  expect((await previewFeedback({ id: 'friend000001', n: 'じろう', to: 'abcdefghijkl', at: 1, c: [] })).mine).toBe(false);
});

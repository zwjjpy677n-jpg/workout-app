import { decodeShare } from './codec';
import { buildFeedbackLink, parseFeedbackPayload, type FeedbackOut, type FeedbackPayload } from './feedbackPayload';

const NOW = new Date(2026, 9, 28, 20).getTime();
const me = { id: 'meeeeeeeeeee', name: 'じろう' };
const c = (o: Partial<FeedbackOut>): FeedbackOut => ({ id: `fb${Math.random().toString(36).slice(2, 10)}`, friendId: 'friend000001', workoutId: null, week: null, exerciseId: null, text: 'ナイス', at: NOW, sentAt: null, ...o });
const read = async (text: string) => parseFeedbackPayload((await decodeShare(text)).data);

test('往復: 記録・種目・週へのコメントが短いIDで入る', async () => {
  const list = [
    c({ workoutId: 'friend000001:aaaaaaaa', text: 'いい日', at: NOW - 3000 }),
    c({ workoutId: 'friend000001:aaaaaaaa', exerciseId: 'friend000001:sq-uuid-', text: '5kg上がってる！', at: NOW - 2000 }),
    c({ week: '2026-10-26', text: '今週もおつかれ', at: NOW - 1000 }),
  ];
  const r = await buildFeedbackLink(me, 'friend000001', list, NOW);
  expect(r.text.split('\n')[0]).toBe('キントレ部 のフィードバックです（3件）。キントレ部 の『友達』タブに貼り付けてね');
  expect(r.sent).toEqual(list.map((x) => x.id));
  expect(r.rest).toBe(0);
  const p = await read(r.text);
  expect(p).toMatchObject({ id: me.id, n: 'じろう', to: 'friend000001', at: Math.floor(NOW / 60000) });
  expect(p.c.map(([fid, w, wk, x, t]) => [fid, w, wk, x, t])).toEqual([
    [list[0].id, 'aaaaaaaa', null, null, 'いい日'],
    [list[1].id, 'aaaaaaaa', null, 'sq-uuid-', '5kg上がってる！'],
    [list[2].id, null, '2026-10-26', null, '今週もおつかれ'],
  ]);
});

test('長すぎると古いコメントから入れて残りを数える', async () => {
  // 圧縮が効かないランダムな文
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(300)), (b) => String.fromCharCode(0x3041 + (b % 80))).join('');
  const list = Array.from({ length: 50 }, (_, i) => c({ week: '2026-10-26', text: rnd(), at: NOW + i }));
  const r = await buildFeedbackLink(me, 'friend000001', list, NOW);
  expect(r.rest).toBeGreaterThan(0);
  expect(r.sent).toEqual(list.slice(0, 50 - r.rest).map((x) => x.id));
  expect(r.text.split('\n').pop()!.length).toBeLessThanOrEqual(7500);
});

test('範囲外は invalid', () => {
  const ok: FeedbackPayload = { id: me.id, n: 'じろう', to: 'friend000001', at: 1, c: [['abcdefghijkl', 'aaaaaaaa', null, null, 'ok', 1]] };
  expect(parseFeedbackPayload(ok)).toEqual(ok);
  const bad: ((p: FeedbackPayload) => unknown)[] = [
    (p) => ({ ...p, c: [['abcdefghijkl', 'aaaaaaaa', null, null, 'あ'.repeat(301), 1]] }),
    (p) => ({ ...p, c: [['abcdefghijkl', 'aaaaaaaa', null, null, '', 1]] }),
    (p) => ({ ...p, c: Array.from({ length: 51 }, () => p.c[0]) }),
    (p) => ({ ...p, c: [['abcdefghijkl', null, '2026-1-1', null, 'x', 1]] }),
    (p) => ({ ...p, c: [['abcdefghijkl', null, null, null, 'x', 1]] }),
    (p) => ({ ...p, to: '' }),
    () => null,
  ];
  for (const f of bad) expect(() => parseFeedbackPayload(f(structuredClone(ok))), String(f)).toThrow(expect.objectContaining({ code: 'invalid' }));
});

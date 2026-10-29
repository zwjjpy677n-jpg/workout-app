import { decodeShare } from './codec';
import { buildMenuLink, parseMenuPayload, type MenuDraft, type MenuPayload } from './menuPayload';

const NOW = new Date(2026, 9, 28, 20).getTime();
const me = { id: 'meeeeeeeeeee', name: 'じろう' };
const draft: MenuDraft = {
  name: 'PUSH',
  weekday: 1,
  items: [
    { name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 75, sets: 3, reps: '5', main: true, inc: 2.5, note: '止める' },
    { name: 'ディップス', bodyPart: 'chest', type: 'bodyweight', restSec: 90, sets: 3, reps: '10', main: false, inc: 2.5, note: '' },
  ],
};

test('往復: 名前・曜日・種目（レスト・目標・メイン・上げ幅・メモ）', async () => {
  const r = await buildMenuLink(me, 'friend000001', draft, NOW);
  expect(r.text.split('\n')[0]).toBe('キントレ部 のメニュー『PUSH（月）』です。キントレ部 の『友達』タブに貼り付けてね');
  const p = parseMenuPayload((await decodeShare(r.text)).data);
  expect(p).toEqual(r.payload);
  expect(p).toMatchObject({ id: me.id, n: 'じろう', to: 'friend000001', name: 'PUSH', weekday: 1 });
  expect(p.mid).toMatch(/^[A-Za-z0-9]{12}$/);
  expect(p.items).toEqual([
    ['ベンチプレス', 0, 0, 75, 3, '5', 1, 2.5, '止める'],
    ['ディップス', 0, 1, 90, 3, '10', 0, 2.5, ''],
  ]);
  const none = await buildMenuLink(me, 'friend000001', { ...draft, weekday: null }, NOW);
  expect(none.payload.weekday).toBe(-1);
  expect(none.text).toContain('『PUSH』');
});

test('範囲外は invalid', async () => {
  const ok = (await buildMenuLink(me, 'friend000001', draft, NOW)).payload;
  const bad: ((p: MenuPayload) => unknown)[] = [
    (p) => { p.items[0][3] = 5; return p; },
    (p) => { p.items[0][4] = 21; return p; },
    (p) => { p.items[0][7] = 0; return p; },
    (p) => { p.items[0][0] = 'あ'.repeat(41); return p; },
    (p) => ({ ...p, items: [] }),
    (p) => ({ ...p, name: '' }),
    (p) => ({ ...p, weekday: 7 }),
    (p) => ({ ...p, mid: '' }),
  ];
  for (const f of bad) expect(() => parseMenuPayload(f(structuredClone(ok))), String(f)).toThrow(expect.objectContaining({ code: 'invalid' }));
});

test('同じ種目（前後の空白違いも）や空の目標は invalid', async () => {
  const ok = (await buildMenuLink(me, 'friend000001', draft, NOW)).payload;
  expect(() => parseMenuPayload({ ...ok, items: [ok.items[0], [' ベンチプレス ', ...ok.items[0].slice(1)]] })).toThrow(expect.objectContaining({ code: 'invalid' }));
  expect(() => parseMenuPayload({ ...ok, items: [[...ok.items[0].slice(0, 5), ' ', ...ok.items[0].slice(6)]] })).toThrow(expect.objectContaining({ code: 'invalid' }));
});

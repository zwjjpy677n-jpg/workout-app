import { entry, ex, set, wk } from '../../test/factories';
import { parseSharePayload, toFriendRecords } from './importShare';
import { buildSharePayload, type SharePayload } from './sharePayload';

const NOW = new Date(2026, 9, 28, 20).getTime();
const bench = ex('bench-uuid-0001', { name: 'ベンチプレス' });
const plank = ex('plank-uuid-0002', { name: 'プランク', type: 'time', bodyPart: 'core' });
const w1 = wk(NOW - 86400_000, [entry(bench.id, [set({ weight: 80, reps: 8, rpe: 8 }), set({ weight: 82.5, reps: 5 })]), entry(plank.id, [set({ durationSec: 60 })])], { id: 'work-uuid-1111', name: 'PUSH' });
const src = { profile: { id: 'abcdefghijkl', name: 'たろう' }, exercises: [bench, plank], workouts: [w1] };
// 今の GRIND はメニューを送らないが、古い版から届いたリンクのメニューも読めること
const payload = (): SharePayload => ({ ...(JSON.parse(JSON.stringify(buildSharePayload(src, NOW))) as SharePayload), r: [['PUSH', 1, [[0, 3, '5', 1]]]] });

test('作った payload を変換すると本番セット・種目・メニュー・自己ベストが戻る', () => {
  const { friend, workouts } = toFriendRecords(parseSharePayload(payload()), NOW + 1000);
  expect(friend).toMatchObject({ id: 'abcdefghijkl', name: 'たろう', receivedAt: NOW + 1000, sharedAt: Math.floor(NOW / 60000) * 60000 });
  expect(friend.exercises).toEqual([
    { id: 'abcdefghijkl:bench-uu', name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 0, archived: false, createdAt: 0, barKg: null },
    { id: 'abcdefghijkl:plank-uu', name: 'プランク', bodyPart: 'core', type: 'time', restSec: 0, archived: false, createdAt: 0, barKg: null },
  ]);
  expect(friend.routines).toEqual([
    { id: 'abcdefghijkl:menu:PUSH', name: 'PUSH', weekday: 1, createdAt: NOW + 1000, items: [{ exerciseId: 'abcdefghijkl:bench-uu', sets: 3, reps: '5', main: true, inc: 0, note: '' }] },
  ]);
  expect(friend.prs).toEqual([
    { exerciseId: 'abcdefghijkl:bench-uu', set: { weight: 80, reps: 8, durationSec: null, rpe: 8, warmup: false, note: '', done: true } },
    { exerciseId: 'abcdefghijkl:plank-uu', set: { weight: null, reps: null, durationSec: 60, rpe: null, warmup: false, note: '', done: true } },
  ]);
  expect(workouts).toHaveLength(1);
  const w = workouts[0];
  expect(w).toMatchObject({ id: 'abcdefghijkl:work-uui', friendId: 'abcdefghijkl', name: 'PUSH', startedAt: Math.floor(w1.startedAt / 60000) * 60000, note: '', routineId: null });
  expect(w.endedAt).toBe(w.startedAt);
  expect(w.condition).toEqual({ sleep: null, fatigue: null, motivation: null });
  expect(w.entries.map((e) => [e.exerciseId, e.sets.map((s) => [s.weight, s.reps, s.durationSec, s.rpe, s.done, s.warmup])])).toEqual([
    ['abcdefghijkl:bench-uu', [[80, 8, null, 8, true, false], [82.5, 5, null, null, true, false]]],
    ['abcdefghijkl:plank-uu', [[null, null, 60, null, true, false]]],
  ]);
});

test('範囲外・型違い・巨大な配列は invalid', () => {
  const bad: ((p: SharePayload) => unknown)[] = [
    (p) => { p.w[0][3][0][1][0][0] = 1001; return p; },
    (p) => { p.w[0][3][0][1][0][1] = -1; return p; },
    (p) => { p.w[0][3][0][1][0][3] = 11; return p; },
    (p) => { p.w[0][3][1][1][0][2] = 36001; return p; },
    (p) => ({ ...p, n: '' }),
    (p) => ({ ...p, n: 'あ'.repeat(41) }),
    (p) => ({ ...p, id: '' }),
    (p) => ({ ...p, x: Array.from({ length: 301 }, (_, i) => [`e${i}`, `種目${i}`, 0, 0]) }),
    (p) => { p.x[0][1] = ''; return p; },
    (p) => { p.x[0][2] = 99; return p; },
    (p) => { p.w[0][3][0][0] = 99; return p; },
    (p) => { p.r[0][2][0][0] = 99; return p; },
    (p) => { p.p[0][0] = -1; return p; },
    (p) => ({ ...p, w: 'x' }),
    (p) => ({ ...p, w: Array.from({ length: 501 }, () => p.w[0]) }),
    (p) => ({ ...p, r: Array.from({ length: 31 }, () => p.r[0]) }),
    () => null,
    () => [1, 2],
  ];
  for (const f of bad) expect(() => parseSharePayload(f(payload())), String(f)).toThrow(expect.objectContaining({ code: 'invalid' }));
});

test('長い種目名・記録名や多すぎるセットでも、作ったリンクは受け取れる', () => {
  const long = ex('long-uuid-0001', { name: 'と'.repeat(60) });
  const sets = Array.from({ length: 60 }, () => set({ weight: 50, reps: 5 }));
  const wo = wk(NOW - 86400_000, [entry(long.id, sets)], { id: 'long-work-1', name: 'メ'.repeat(60) });
  const p = JSON.parse(JSON.stringify(buildSharePayload({ ...src, exercises: [long], workouts: [wo] }, NOW))) as SharePayload;
  const parsed = parseSharePayload(p);
  expect(parsed.x[0][1]).toHaveLength(40);
  expect(parsed.w[0][2]).toHaveLength(40);
  expect(parsed.w[0][3][0][1]).toHaveLength(50);
  expect(parsed.r).toEqual([]);
});

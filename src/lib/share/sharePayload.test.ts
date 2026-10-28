import { emptyCondition, type Exercise, type Workout } from '../types';
import { entry, ex, item, routine, set, wk } from '../../test/factories';
import { buildShareLink, buildSharePayload } from './sharePayload';

const NOW = new Date(2026, 9, 28, 20).getTime();
const DAY = 86400_000;
const profile = { id: 'abcdefghijkl', name: 'たろう' };
const bench = ex('bench-uuid-0001', { name: 'ベンチプレス' });
const pull = ex('pull-uuid-00002', { name: '懸垂', type: 'bodyweight', bodyPart: 'back' });
const unused = ex('unused-uuid-003', { name: '使わない' });

test('入れるのは56日以内・終了済み・本番セットだけ', () => {
  const recent = wk(NOW - 2 * DAY, [
    entry(bench.id, [set({ weight: 40, reps: 10, warmup: true }), set({ weight: 80, reps: 8, rpe: 8 }), { ...set({ weight: 85, reps: 5 }), done: false }]),
    entry(pull.id, [set({ weight: 0, reps: 10, warmup: true })]),
  ], { name: 'PUSH' });
  const old = wk(NOW - 57 * DAY, [entry(bench.id, [set({ weight: 70, reps: 8 })])]);
  const active = wk(NOW - DAY, [entry(bench.id, [set({ weight: 90, reps: 3 })])], { endedAt: null });
  const p = buildSharePayload({ profile, exercises: [bench, pull, unused], routines: [], workouts: [recent, old, active] }, NOW);
  expect(p.id).toBe(profile.id);
  expect(p.n).toBe('たろう');
  expect(p.at).toBe(Math.floor(NOW / 60000));
  expect(p.w).toHaveLength(1);
  const [id8, start, name, entries] = p.w[0];
  expect([id8, start, name]).toEqual([recent.id.slice(0, 8), Math.floor(recent.startedAt / 60000), 'PUSH']);
  expect(entries).toHaveLength(1);
  expect(p.x[entries[0][0]][1]).toBe('ベンチプレス');
  expect(entries[0][1]).toEqual([[80, 8, null, 8]]);
});

test('送らない項目が入らない', () => {
  const w: Workout = {
    ...wk(NOW - DAY, [{ exerciseId: bench.id, sets: [set({ weight: 80, reps: 8, note: 'セットのひみつメモ' })], slowed: true, target: { sets: 3, reps: '5', main: true, inc: 2.5, note: '目標メモ' } }]),
    note: '記録のひみつメモ',
    condition: { ...emptyCondition(), sleep: 4 },
  };
  const json = JSON.stringify(buildSharePayload({ profile, exercises: [bench], routines: [], workouts: [w] }, NOW));
  for (const s of ['ひみつメモ', '目標メモ', 'slowed', 'sleep', 'condition', 'note']) expect(json).not.toContain(s);
});

test('種目は参照されるものだけ、短いIDは先頭8文字、部位とタイプは番号', () => {
  const p = buildSharePayload({ profile, exercises: [bench, pull, unused], routines: [], workouts: [wk(NOW - DAY, [entry(pull.id, [set({ weight: 10, reps: 6 })])])] }, NOW);
  expect(p.x).toEqual([['pull-uui', '懸垂', 1, 1]]);
});

test('メニュー（曜日なしは -1）と全期間の自己ベスト', () => {
  const r = routine('PULL', [item(pull.id, { sets: 4, reps: '6〜8', main: true })]);
  const r2 = routine('PUSH', [item(bench.id, { sets: 3, reps: '5' })], { weekday: 1 });
  const old = wk(NOW - 100 * DAY, [entry(bench.id, [set({ weight: 100, reps: 3 })])]);
  const recent = wk(NOW - DAY, [entry(bench.id, [set({ weight: 80, reps: 8 })])]);
  const p = buildSharePayload({ profile, exercises: [bench, pull], routines: [r, r2], workouts: [old, recent] }, NOW);
  const xi = (id: string) => p.x.findIndex((x) => x[0] === id.slice(0, 8));
  expect(p.r).toEqual([['PULL', -1, [[xi(pull.id), 4, '6〜8', 1]]], ['PUSH', 1, [[xi(bench.id), 3, '5', 0]]]]);
  expect(p.p).toEqual([[xi(bench.id), [100, 3, null, null]]]);
});

// 種目40、1日8種目×5セットを毎日（＝普通より極端に多い）
function heavy(): { exercises: Exercise[]; workouts: Workout[] } {
  const exercises = Array.from({ length: 40 }, (_, i) => ex(`ex-${String(i).padStart(4, '0')}-uuid`, { name: `種目${i}` }));
  const workouts = Array.from({ length: 56 }, (_, d) =>
    wk(NOW - d * DAY - 3600_000, Array.from({ length: 8 }, (_, k) => entry(exercises[(d + k) % 40].id, Array.from({ length: 5 }, (_, s) => set({ weight: 20 + ((d * 7 + k * 3 + s) % 180), reps: 3 + ((d + s) % 10), rpe: 6 + (s % 4) })))), { id: `w-${d}-uuid-xyz` }),
  );
  return { exercises, workouts };
}

test('長すぎると古い週から削り、リンクは7,500文字以内', async () => {
  const { exercises, workouts } = heavy();
  const r = await buildShareLink({ profile, exercises, routines: [], workouts }, NOW);
  expect(r.trimmed).toBe(true);
  expect(r.weeks).toBeLessThan(8);
  expect(r.weeks).toBeGreaterThan(0);
  const link = r.text.split('\n').pop()!;
  expect(link).toMatch(/#\/friends\/add\?d=r1/);
  expect(link.length).toBeLessThanOrEqual(7500);
  expect(r.text).toContain('GRIND の『友達』タブに貼り付けてね');
});

test('1週間でも収まらないと too-large', async () => {
  const exercises = Array.from({ length: 300 }, (_, i) => ex(`${String(i).padStart(8, '0')}-u`, { name: `とても長い名前の種目その${i}` }));
  const workouts = Array.from({ length: 7 }, (_, d) =>
    wk(NOW - d * DAY - 3600_000, exercises.map((e, k) => entry(e.id, Array.from({ length: 10 }, (_, s) => set({ weight: (d * 37 + k * 13 + s * 7) % 997, reps: (k + s) % 50, rpe: 1 + (s % 10) })))), { id: `big-${d}-uuid` }),
  );
  await expect(buildShareLink({ profile, exercises, routines: [], workouts }, NOW)).rejects.toMatchObject({ code: 'too-large' });
});

test('普通の量（週4回×8週・1回8種目×4セット）なら8週間ぶん収まる', async () => {
  const exercises = Array.from({ length: 24 }, (_, i) => ex(crypto.randomUUID(), { name: `種目${i}` }));
  let seed = 7;
  const rnd = (n: number) => (seed = (seed * 9301 + 49297) % 233280) % n;
  const workouts = Array.from({ length: 32 }, (_, i) =>
    wk(NOW - Math.floor(i / 4) * 7 * DAY - (i % 4) * DAY - 3600_000, Array.from({ length: 8 }, (_, k) => entry(exercises[(i * 3 + k) % 24].id, Array.from({ length: 4 }, () => set({ weight: 20 + rnd(181) / 2, reps: 3 + rnd(10), rpe: 6 + rnd(9) / 2 })))), { id: crypto.randomUUID(), name: 'PUSH' }),
  );
  const r = await buildShareLink({ profile, exercises, routines: [], workouts }, NOW);
  expect(r).toMatchObject({ trimmed: false, weeks: 8, count: 32 });
  console.log('普通の量のリンク文字数:', r.text.split('\n').pop()!.length);
});

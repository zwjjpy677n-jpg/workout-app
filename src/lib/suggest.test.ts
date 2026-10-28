import { set } from '../test/factories';
import { suggest } from './suggest';
import type { EntryTarget } from './types';

const t = (o: Partial<EntryTarget>): EntryTarget => ({ sets: 3, reps: '5', main: false, inc: 2.5, note: '', ...o });
const ws = (...pairs: [number, number][]) => pairs.map(([w, r]) => set({ weight: w, reps: r }));

test('初回', () =>
  expect(suggest({ target: t({}), type: 'weight', prev: null, deload: false })).toEqual({
    sets: 3, weight: null, reps: 5, durationSec: null, reason: '初回：フォームが崩れず、目標回数をきれいにこなせる重さで',
  }));

test('メイン: 達成→+inc', () =>
  expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5], [80, 5], [80, 6]), slowed: false }, deload: false })).toMatchObject({
    weight: 82.5, reason: '前回はスピードを保てたので+2.5kg',
  }));

test('メイン: スピード低下→同じ', () =>
  expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5]), slowed: true }, deload: false })).toMatchObject({
    weight: 80, reason: '前回スピードが落ちたので、同じ重さでやり直し',
  }));

test('メイン: 未達→同じ', () =>
  expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5], [80, 4]), slowed: false }, deload: false })).toMatchObject({
    weight: 80, reason: '前回は目標回数に届かなかったので、同じ重さ',
  }));

test('補助: 最大重量のセットだけで判定', () => {
  expect(suggest({ target: t({ inc: 2 }), type: 'weight', prev: { sets: ws([80, 5], [80, 5], [75, 3]), slowed: false }, deload: false })).toMatchObject({
    weight: 82, reason: '全セット目標回数に届いたので+2kg',
  });
  expect(suggest({ target: t({}), type: 'weight', prev: { sets: ws([80, 5], [80, 4], [75, 6]), slowed: false }, deload: false })).toMatchObject({
    weight: 80, reason: '全セットで目標回数に届くまで同じ重さ',
  });
});

test('上げ幅1.25の丸め', () =>
  expect(suggest({ target: t({ inc: 1.25 }), type: 'weight', prev: { sets: ws([61.25, 5]), slowed: false }, deload: false }).weight).toBe(62.5));

test('ウォームアップと未完了は無視', () =>
  expect(suggest({ target: t({}), type: 'weight', prev: { sets: [set({ weight: 100, reps: 1, warmup: true }), set({ weight: 90, reps: 9, done: false }), set({ weight: 60, reps: 5 })], slowed: false }, deload: false }).weight).toBe(62.5));

test('回復週: 同じ重さでセット半分', () => {
  expect(suggest({ target: t({ sets: 3 }), type: 'weight', prev: { sets: ws([80, 5]), slowed: false }, deload: true })).toMatchObject({
    sets: 2, weight: 80, reason: '回復週：重さはそのまま、セット数を半分に',
  });
  expect(suggest({ target: t({ sets: 1 }), type: 'weight', prev: null, deload: true }).sets).toBe(1);
});

test('自重・時間', () => {
  expect(suggest({ target: t({ reps: '8' }), type: 'bodyweight', prev: { sets: [set({ weight: 10, reps: 8 })], slowed: false }, deload: false })).toEqual({
    sets: 3, weight: 10, reps: 8, durationSec: null, reason: '前回より質を上げることを意識',
  });
  expect(suggest({ target: t({ reps: '左右30秒' }), type: 'time', prev: null, deload: true })).toEqual({
    sets: 2, weight: null, reps: null, durationSec: 30, reason: '回復週：セット数を減らして軽めに',
  });
});

test('自重のアシスト（負の加重）を引き継ぐ', () => {
  expect(suggest({ target: t({ reps: '8' }), type: 'bodyweight', prev: { sets: [set({ weight: -20, reps: 8 }), set({ weight: -20, reps: 8 })], slowed: false }, deload: false }).weight).toBe(-20);
  expect(suggest({ target: t({ reps: '8' }), type: 'bodyweight', prev: { sets: [set({ weight: null, reps: 8 })], slowed: false }, deload: false }).weight).toBeNull();
});

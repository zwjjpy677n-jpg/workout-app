import { entry, ex, item, routine, set, wk } from '../test/factories';
import { defaultItem } from './types';
import { parseBackup, type BackupData } from './backup';

const valid: BackupData = {
  app: 'ironlog',
  version: 2,
  exportedAt: 1,
  exercises: [ex('bench', { barKg: 20 }), ex('plank', { type: 'time' })],
  routines: [routine('PUSH', [item('bench', { main: true })], { weekday: 1 })],
  workouts: [wk(1000, [entry('bench', [set({ weight: 80, reps: 8, rpe: 8, note: 'good' })])])],
  bodyweights: [{ date: '2026-10-28', kg: 71.2 }],
  settings: { barKg: 20, plates: [25, 20] },
  program: { startDate: '2026-10-26', tests: { start: null, end: { date: '2026-12-20', bodyweight: null, lifts: { bench: 100 } } } },
};

const mutate = (f: (d: any) => void) => {
  const d = structuredClone(valid);
  f(d);
  return JSON.stringify(d);
};

test('正常データは往復できる', () => {
  expect(parseBackup(JSON.stringify(valid))).toEqual(valid);
});

test.each([
  ['JSONでない', 'not json'],
  ['null', 'null'],
  ['app違い', mutate((d) => (d.app = 'other'))],
  ['version 3', mutate((d) => (d.version = 3))],
  ['items.sets が文字列', mutate((d) => (d.routines[0].items[0].sets = '3'))],
  ['weekday が範囲外', mutate((d) => (d.routines[0].weekday = 7))],
  ['program.startDate 形式', mutate((d) => (d.program.startDate = '2026/10/1'))],
  ['barKg が文字列', mutate((d) => (d.exercises[0].barKg = '20'))],
  ['種目IDの重複', mutate((d) => d.exercises.push({ ...d.exercises[0] }))],
  ['ルーティンが存在しない種目を参照', mutate((d) => (d.routines[0].items[0].exerciseId = 'ghost'))],
  ['記録が存在しない種目を参照', mutate((d) => (d.workouts[0].entries[0].exerciseId = 'ghost'))],
  ['記録中のワークアウトが2件', mutate((d) => d.workouts.push({ ...d.workouts[0], id: 'a1', endedAt: null }, { ...d.workouts[0], id: 'a2', endedAt: null }))],
  ['ワークアウトIDの重複', mutate((d) => d.workouts.push({ ...d.workouts[0] }))],
  ['重量が範囲外', mutate((d) => (d.workouts[0].entries[0].sets[0].weight = 5000))],
  ['RPEが範囲外', mutate((d) => (d.workouts[0].entries[0].sets[0].rpe = 11))],
  ['体重が範囲外', mutate((d) => (d.bodyweights[0].kg = 5))],
  ['体重の日付が重複', mutate((d) => d.bodyweights.push({ ...d.bodyweights[0] }))],
  ['体脂肪率が範囲外', mutate((d) => (d.bodyweights[0].fatPct = 80))],
  ['体脂肪率が文字列', mutate((d) => (d.bodyweights[0].fatPct = '15'))],
  ['コンディションが範囲外', mutate((d) => (d.workouts[0].condition.sleep = 9))],
  ['セット数が範囲外', mutate((d) => (d.routines[0].items[0].sets = 0))],
  ['workoutsが配列でない', mutate((d) => (d.workouts = {}))],
  ['種目タイプ不正', mutate((d) => (d.exercises[0].type = 'cardio'))],
  ['部位不正', mutate((d) => (d.exercises[0].bodyPart = 'neck'))],
  ['doneが文字列', mutate((d) => (d.workouts[0].entries[0].sets[0].done = 'yes'))],
  ['weightが文字列', mutate((d) => (d.workouts[0].entries[0].sets[0].weight = '80'))],
  ['conditionなし', mutate((d) => delete d.workouts[0].condition)],
  ['体重の日付形式', mutate((d) => (d.bodyweights[0].date = '2026/10/1'))],
  ['settingsなし', mutate((d) => delete d.settings)],
])('%s は拒否', (_, text) => {
  expect(() => parseBackup(text)).toThrow('バックアップファイルの形式が正しくありません');
});

test('version 1 は v2 に変換して読み込む', () => {
  const v1 = {
    app: 'ironlog', version: 1, exportedAt: 1,
    exercises: [{ id: 'sq', name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 90, archived: false, createdAt: 0 }],
    routines: [{ id: 'r1', name: 'LEG', exerciseIds: ['sq'], createdAt: 0 }],
    workouts: [{ id: 'w', name: 'W', startedAt: 1, endedAt: 2, note: '', condition: { sleep: null, fatigue: null, motivation: null }, entries: [] }],
    bodyweights: [], settings: { barKg: 20, plates: [20] },
  };
  const d = parseBackup(JSON.stringify(v1));
  expect(d.version).toBe(2);
  expect(d.program).toBeNull();
  expect(d.routines[0]).toEqual({ id: 'r1', name: 'LEG', weekday: null, items: [defaultItem('sq')], createdAt: 0 });
  expect(d.exercises[0].barKg).toBe(20);
  expect(d.workouts[0].routineId).toBeNull();
});

test('記録中のワークアウト1件と範囲内の負の加重は受け付ける', () => {
  const ok = mutate((d) => {
    d.workouts.push({ ...d.workouts[0], id: 'a1', endedAt: null });
    d.workouts[0].entries[0].sets[0].weight = -20;
  });
  expect(parseBackup(ok).workouts).toHaveLength(2);
});

test('v1 も参照チェックを通す', () => {
  const v1 = {
    app: 'ironlog', version: 1, exportedAt: 1,
    exercises: [{ id: 'sq', name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 90, archived: false, createdAt: 0 }],
    routines: [{ id: 'r1', name: 'LEG', exerciseIds: ['ghost'], createdAt: 0 }],
    workouts: [], bodyweights: [], settings: { barKg: 20, plates: [20] },
  };
  expect(() => parseBackup(JSON.stringify(v1))).toThrow('バックアップファイルの形式が正しくありません');
});

test('体脂肪率は無くても null でも範囲内でも受け付ける', () => {
  for (const fat of [undefined, null, 15.3]) {
    const text = mutate((d) => {
      if (fat === undefined) delete d.bodyweights[0].fatPct;
      else d.bodyweights[0].fatPct = fat;
    });
    expect(() => parseBackup(text)).not.toThrow();
  }
});

test('プロフィールは有っても無くても読め、形がおかしければ拒否', () => {
  const withProfile = { ...valid, profile: { id: 'abcdefghijkl', name: 'たろう' } };
  expect(parseBackup(JSON.stringify(withProfile))).toEqual(withProfile);
  expect(parseBackup(JSON.stringify(valid)).profile).toBeUndefined();
  expect(() => parseBackup(mutate((d) => (d.profile = { id: '', name: 'x' })))).toThrow();
  expect(() => parseBackup(mutate((d) => (d.profile = { id: 'abcdefghijkl', name: '' })))).toThrow();
});

test('メニューのレストは無くても null でも 10〜600 でも読め、範囲外は拒否', () => {
  for (const restSec of [undefined, null, 60]) {
    expect(() => parseBackup(mutate((d) => { d.routines[0].items[0].restSec = restSec; d.workouts[0].entries[0].target = { sets: 3, reps: '5', main: false, inc: 2.5, note: '', restSec }; }))).not.toThrow();
  }
  expect(() => parseBackup(mutate((d) => (d.routines[0].items[0].restSec = 5)))).toThrow();
  expect(() => parseBackup(mutate((d) => (d.workouts[0].entries[0].target = { sets: 3, reps: '5', main: false, inc: 2.5, note: '', restSec: 601 })))).toThrow();
});

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

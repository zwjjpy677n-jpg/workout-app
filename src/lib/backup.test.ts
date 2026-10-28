import { entry, ex, set, wk } from '../test/factories';
import { parseBackup, type BackupData } from './backup';

const valid: BackupData = {
  app: 'ironlog',
  version: 1,
  exportedAt: 1,
  exercises: [ex('bench'), ex('plank', { type: 'time' })],
  routines: [{ id: 'r1', name: 'PUSH', exerciseIds: ['bench'], createdAt: 0 }],
  workouts: [wk(1000, [entry('bench', [set({ weight: 80, reps: 8, rpe: 8, note: 'good' })])])],
  bodyweights: [{ date: '2026-10-28', kg: 71.2 }],
  settings: { barKg: 20, plates: [25, 20] },
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
  ['version 2', mutate((d) => (d.version = 2))],
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

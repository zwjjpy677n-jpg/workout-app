import { ex } from '../test/factories';
import { resetDb } from './db';
import {
  addExercise, deleteBodyweight, exportAll, finishWorkout, getActiveWorkout, getSettings, importAll, isExerciseUsed,
  listBodyweights, listExercises, listRoutines, listWorkouts, removeExercise, saveRoutine, saveSettings, saveWorkout,
  setBodyweight, startWorkout, updateExercise, deleteRoutine, deleteWorkout, saveEditedWorkout,
} from './repository';
import { ensureSeeded, SEED_EXERCISES } from './seed';

beforeEach(resetDb);

const benchId = async () => (await listExercises()).find((e) => e.name === 'ベンチプレス')!.id;

test('ensureSeededは冪等で14種目', async () => {
  await ensureSeeded();
  await ensureSeeded();
  expect(await listExercises()).toHaveLength(14);
  expect(SEED_EXERCISES.filter((e) => e.type === 'bodyweight').map((e) => e.name)).toEqual(['ディップス', '懸垂']);
  expect(SEED_EXERCISES.find((e) => e.name === 'プランク')?.type).toBe('time');
});

test('種目の追加・更新', async () => {
  const e = await addExercise({ name: 'ブルガリアンスクワット', bodyPart: 'legs', type: 'weight', restSec: 90 });
  expect(e.archived).toBe(false);
  await updateExercise(e.id, { name: 'BSS' });
  expect((await listExercises())[0].name).toBe('BSS');
});

test('使用中の種目はアーカイブ、未使用は削除', async () => {
  await ensureSeeded();
  const bench = await benchId();
  const w = await startWorkout({ name: 'PUSH', exerciseIds: [bench] });
  expect(await isExerciseUsed(bench)).toBe(true);
  expect(await removeExercise(bench)).toBe('archived');
  expect((await listExercises()).some((e) => e.id === bench)).toBe(false);
  expect((await listExercises({ includeArchived: true })).find((e) => e.id === bench)?.archived).toBe(true);
  const squat = (await listExercises()).find((e) => e.name === 'スクワット')!.id;
  expect(await removeExercise(squat)).toBe('deleted');
  expect((await listExercises({ includeArchived: true })).some((e) => e.id === squat)).toBe(false);
  expect(w.entries).toHaveLength(1);
});

test('使用中の種目のタイプ変更は拒否', async () => {
  await ensureSeeded();
  const bench = await benchId();
  await startWorkout({ name: 'X', exerciseIds: [bench] });
  await expect(updateExercise(bench, { type: 'time' })).rejects.toThrow('記録済みの種目はタイプを変更できません');
  await expect(updateExercise(bench, { type: 'weight', name: 'BP' })).resolves.toBeUndefined();
});

test('startWorkoutを2回呼んでも進行中は1件', async () => {
  const a = await startWorkout({ name: 'PUSH', exerciseIds: ['bench'] });
  expect(a.entries[0].sets).toHaveLength(1);
  const b = await startWorkout({ name: 'X', exerciseIds: [] });
  expect(b.id).toBe(a.id);
  expect(await listWorkouts()).toHaveLength(1);
  expect((await getActiveWorkout())?.id).toBe(a.id);
});

test('finishWorkout: 完了セット0の種目は除外、全0なら empty', async () => {
  const w = await startWorkout({ name: 'P', exerciseIds: ['a', 'b'] });
  expect(await finishWorkout(w.id, 5)).toBe('empty');
  expect((await getActiveWorkout())?.id).toBe(w.id);
  w.entries[0].sets[0] = { ...w.entries[0].sets[0], weight: 50, reps: 5, done: true, warmup: true };
  await saveWorkout(w);
  expect(await finishWorkout(w.id, 99)).toBe('saved');
  const [saved] = await listWorkouts();
  expect(saved.endedAt).toBe(99);
  expect(saved.entries.map((e) => e.exerciseId)).toEqual(['a']);
  expect(await getActiveWorkout()).toBeUndefined();
  await deleteWorkout(w.id);
  expect(await listWorkouts()).toHaveLength(0);
});

test('ルーティンのCRUD', async () => {
  const r = await saveRoutine({ name: 'PUSH', exerciseIds: ['a'] });
  await saveRoutine({ ...r, name: 'PUSH2' });
  expect((await listRoutines()).map((x) => x.name)).toEqual(['PUSH2']);
  await deleteRoutine(r.id);
  expect(await listRoutines()).toHaveLength(0);
});

test('体重は1日1件で上書き', async () => {
  await setBodyweight('2026-10-28', 70);
  await setBodyweight('2026-10-28', 71.2);
  await setBodyweight('2026-10-01', 69);
  expect(await listBodyweights()).toEqual([{ date: '2026-10-01', kg: 69 }, { date: '2026-10-28', kg: 71.2 }]);
  await deleteBodyweight('2026-10-01');
  expect(await listBodyweights()).toHaveLength(1);
});

test('設定は未保存ならデフォルト', async () => {
  expect(await getSettings()).toEqual({ barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] });
  await saveSettings({ barKg: 15, plates: [20] });
  expect(await getSettings()).toEqual({ barKg: 15, plates: [20] });
});

test('export→importで往復し、importAll途中失敗時は元データのまま', async () => {
  await ensureSeeded();
  await setBodyweight('2026-10-28', 70);
  const data = await exportAll(123);
  expect(data).toMatchObject({ app: 'ironlog', version: 1, exportedAt: 123 });
  await importAll({ ...data, exercises: [ex('only')], bodyweights: [] });
  expect(await listExercises()).toHaveLength(1);
  await importAll(data);
  expect(await listExercises()).toHaveLength(14);
  await expect(importAll({ ...data, exercises: [ex('dup'), ex('dup')] })).rejects.toThrow();
  expect(await listExercises()).toHaveLength(14);
  expect(await listBodyweights()).toHaveLength(1);
});

test('saveEditedWorkout: 完了セットのない種目を除き endedAt は維持、全0なら empty', async () => {
  const w = await startWorkout({ name: 'P', exerciseIds: ['a', 'b'] });
  w.entries[0].sets[0] = { ...w.entries[0].sets[0], weight: 50, reps: 5, done: true };
  await saveWorkout(w);
  await finishWorkout(w.id, 77);
  const edited = (await listWorkouts())[0];
  edited.entries.push({ exerciseId: 'c', sets: [{ ...edited.entries[0].sets[0], done: false }] });
  await saveWorkout(edited);
  expect(await saveEditedWorkout(w.id)).toBe('saved');
  expect((await listWorkouts())[0]).toMatchObject({ endedAt: 77 });
  expect((await listWorkouts())[0].entries.map((e) => e.exerciseId)).toEqual(['a']);
  const cur = (await listWorkouts())[0];
  cur.entries[0].sets[0].done = false;
  await saveWorkout(cur);
  expect(await saveEditedWorkout(w.id)).toBe('empty');
});

test('種目を削除・アーカイブするとルーティンからも外れる', async () => {
  await ensureSeeded();
  const all = await listExercises();
  const [a, b] = all;
  await saveRoutine({ name: 'R', exerciseIds: [a.id, b.id] });
  await startWorkout({ name: 'X', exerciseIds: [b.id] });
  expect(await removeExercise(a.id)).toBe('deleted');
  expect(await removeExercise(b.id)).toBe('archived');
  expect((await listRoutines())[0].exerciseIds).toEqual([]);
});

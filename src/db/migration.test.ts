import Dexie from 'dexie';
import { defaultItem } from '../lib/types';
import { db } from './db';
import { listExercises, listRoutines, listWorkouts } from './repository';

test('version 1 のデータを version 2 に移行する', async () => {
  db.close();
  await Dexie.delete('ironlog');
  const old = new Dexie('ironlog');
  old.version(1).stores({ exercises: 'id, bodyPart, archived', routines: 'id', workouts: 'id, startedAt, endedAt', bodyweights: 'date', settings: 'key' });
  await old.open();
  await old.table('exercises').bulkAdd([
    { id: 'sq', name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 180, archived: false, createdAt: 0 },
    { id: 'pu', name: '懸垂', bodyPart: 'back', type: 'bodyweight', restSec: 90, archived: false, createdAt: 1 },
  ]);
  await old.table('routines').add({ id: 'r1', name: 'R', exerciseIds: ['a', 'b'], createdAt: 0 });
  const sets = [
    { weight: 40, reps: 10, durationSec: null, rpe: null, warmup: true, note: '', done: true },
    { weight: 100, reps: 5, durationSec: null, rpe: 8, warmup: false, note: '重い', done: true },
  ];
  await old.table('workouts').add({ id: 'w1', name: 'W', startedAt: 1, endedAt: 2, note: 'メモ', condition: { sleep: 4, fatigue: null, motivation: 5 }, entries: [{ exerciseId: 'sq', sets }] });
  old.close();

  await db.open();
  expect((await listRoutines())[0]).toMatchObject({ weekday: null, items: [defaultItem('a'), defaultItem('b')] });
  expect((await listRoutines())[0]).not.toHaveProperty('exerciseIds');
  expect((await listExercises()).map((e) => [e.name, e.barKg])).toEqual([['スクワット', 20], ['懸垂', null]]);
  const [w] = await listWorkouts();
  expect(w.routineId).toBeNull();
  expect(w).toMatchObject({ note: 'メモ', condition: { sleep: 4, fatigue: null, motivation: 5 } });
  expect(w.entries).toEqual([{ exerciseId: 'sq', sets }]);
});

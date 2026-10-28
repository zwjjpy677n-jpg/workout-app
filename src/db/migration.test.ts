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
  await old.table('workouts').add({ id: 'w1', name: 'W', startedAt: 1, endedAt: 2, note: '', condition: { sleep: null, fatigue: null, motivation: null }, entries: [] });
  old.close();

  await db.open();
  expect((await listRoutines())[0]).toMatchObject({ weekday: null, items: [defaultItem('a'), defaultItem('b')] });
  expect((await listRoutines())[0]).not.toHaveProperty('exerciseIds');
  expect((await listExercises()).map((e) => [e.name, e.barKg])).toEqual([['スクワット', 20], ['懸垂', null]]);
  expect((await listWorkouts())[0].routineId).toBeNull();
});

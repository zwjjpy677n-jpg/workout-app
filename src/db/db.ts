import Dexie, { type Table } from 'dexie';
import type { BodyweightLog, Exercise, Routine, Settings, Workout } from '../lib/types';

export class IronLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  workouts!: Table<Workout, string>;
  bodyweights!: Table<BodyweightLog, string>;
  settings!: Table<Settings & { key: string }, string>;

  constructor() {
    super('ironlog');
    this.version(1).stores({
      exercises: 'id, bodyPart, archived',
      routines: 'id',
      workouts: 'id, startedAt, endedAt',
      bodyweights: 'date',
      settings: 'key',
    });
  }
}

export const db = new IronLogDB();

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

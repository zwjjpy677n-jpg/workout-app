import Dexie, { type Table } from 'dexie';
import { migrateExerciseV1, migrateRoutineV1, migrateWorkoutV1 } from '../lib/backup';
import type { BodyweightLog, Exercise, Program, Routine, Settings, Workout } from '../lib/types';

export type SettingsRow =
  | ({ key: 'app' } & Settings)
  | { key: 'program'; program: Program }
  | { key: 'menuSeeded'; at: number };

const STORES = {
  exercises: 'id, bodyPart, archived',
  routines: 'id',
  workouts: 'id, startedAt, endedAt',
  bodyweights: 'date',
  settings: 'key',
};

export class IronLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  workouts!: Table<Workout, string>;
  bodyweights!: Table<BodyweightLog, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('ironlog');
    this.version(1).stores(STORES);
    // v2: ルーティンに曜日と目標、種目にバー重量、ワークアウトに routineId
    this.version(2)
      .stores(STORES)
      .upgrade(async (tx) => {
        await tx.table('exercises').toCollection().modify((e) => {
          e.barKg = migrateExerciseV1(e).barKg;
        });
        await tx.table('routines').toCollection().modify((r, ref) => {
          ref.value = migrateRoutineV1(r);
        });
        await tx.table('workouts').toCollection().modify((w) => {
          w.routineId = migrateWorkoutV1(w).routineId;
        });
      });
  }
}

export const db = new IronLogDB();

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

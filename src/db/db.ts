import Dexie, { type Table } from 'dexie';
import { migrateExerciseV1, migrateRoutineV1, migrateWorkoutV1 } from '../lib/backup';
import type { FeedbackIn, FeedbackOut } from '../lib/share/feedbackPayload';
import type { Friend, FriendWorkout } from '../lib/share/importShare';
import type { MenuLog } from '../lib/share/menuPayload';
import type { BodyweightLog, Exercise, Program, Routine, Settings, Workout } from '../lib/types';

export type SettingsRow =
  | ({ key: 'app' } & Settings)
  | { key: 'program'; program: Program }
  | { key: 'menuSeeded'; at: number }
  | { key: 'profile'; id: string; name: string };

const STORES = {
  exercises: 'id, bodyPart, archived',
  routines: 'id',
  workouts: 'id, startedAt, endedAt',
  bodyweights: 'date',
  settings: 'key',
};

// v3: 友達から受け取った記録（自分の記録とは別。バックアップにも入れない）。後ろの3つは第2弾（フィードバック・メニュー送信）用
const STORES_V3 = {
  ...STORES,
  friends: 'id',
  friendWorkouts: 'id, friendId, startedAt',
  feedbackIn: 'id, friendId, workoutId, at',
  feedbackOut: 'id, friendId, sentAt',
  menuLog: 'id, friendId, at',
};

/** 自分のデータのテーブル（バックアップの対象） */
export const OWN_TABLES = ['exercises', 'routines', 'workouts', 'bodyweights', 'settings'] as const;

export class IronLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  workouts!: Table<Workout, string>;
  bodyweights!: Table<BodyweightLog, string>;
  settings!: Table<SettingsRow, string>;
  friends!: Table<Friend, string>;
  friendWorkouts!: Table<FriendWorkout, string>;
  feedbackIn!: Table<FeedbackIn, string>;
  feedbackOut!: Table<FeedbackOut, string>;
  menuLog!: Table<MenuLog, string>;

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
    this.version(3).stores(STORES_V3);
  }
}

export const db = new IronLogDB();

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

import type { BodyPart, Exercise, ExerciseType, Settings } from '../lib/types';
import { db } from './db';

type Seed = { name: string; bodyPart: BodyPart; type: ExerciseType; restSec: number };

export const SEED_EXERCISES: Seed[] = [
  { name: 'ベンチプレス', bodyPart: 'chest', type: 'weight', restSec: 180 },
  { name: 'インクラインDBプレス', bodyPart: 'chest', type: 'weight', restSec: 90 },
  { name: 'ディップス', bodyPart: 'chest', type: 'bodyweight', restSec: 90 },
  { name: 'ショルダープレス', bodyPart: 'shoulders', type: 'weight', restSec: 90 },
  { name: 'デッドリフト', bodyPart: 'back', type: 'weight', restSec: 180 },
  { name: '懸垂', bodyPart: 'back', type: 'bodyweight', restSec: 90 },
  { name: 'ベントオーバーロウ', bodyPart: 'back', type: 'weight', restSec: 90 },
  { name: 'ラットプルダウン', bodyPart: 'back', type: 'weight', restSec: 90 },
  { name: 'スクワット', bodyPart: 'legs', type: 'weight', restSec: 180 },
  { name: 'ルーマニアンデッドリフト', bodyPart: 'legs', type: 'weight', restSec: 90 },
  { name: 'レッグプレス', bodyPart: 'legs', type: 'weight', restSec: 90 },
  { name: 'バーベルカール', bodyPart: 'arms', type: 'weight', restSec: 90 },
  { name: 'トライセプスプレスダウン', bodyPart: 'arms', type: 'weight', restSec: 90 },
  { name: 'プランク', bodyPart: 'core', type: 'time', restSec: 90 },
];

export const DEFAULT_SETTINGS: Settings = { barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };

export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    if ((await db.exercises.count()) > 0) return;
    const now = Date.now();
    const rows: Exercise[] = SEED_EXERCISES.map((s, i) => ({ ...s, id: crypto.randomUUID(), archived: false, createdAt: now + i }));
    await db.exercises.bulkAdd(rows);
  });
}

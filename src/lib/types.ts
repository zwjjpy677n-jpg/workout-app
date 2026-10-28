export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';
export type ExerciseType = 'weight' | 'bodyweight' | 'time';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  type: ExerciseType;
  restSec: number;
  archived: boolean;
  createdAt: number;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: number;
}

export interface WorkoutSet {
  /** weight: kg / bodyweight: 加重kg（負=アシスト）/ time: 未使用 */
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
  rpe: number | null;
  warmup: boolean;
  note: string;
  done: boolean;
}

export interface WorkoutEntry {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Condition {
  sleep: number | null;
  /** 5 = 疲れていない */
  fatigue: number | null;
  motivation: number | null;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  /** null = 進行中 */
  endedAt: number | null;
  note: string;
  condition: Condition;
  entries: WorkoutEntry[];
}

export interface BodyweightLog {
  /** 'YYYY-MM-DD' */
  date: string;
  kg: number;
}

export interface Settings {
  barKg: number;
  plates: number[];
}

export const BODY_PARTS: BodyPart[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other'];

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  chest: '胸', back: '背中', shoulders: '肩', arms: '腕', legs: '脚', core: '体幹', other: 'その他',
};

export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  weight: '重量×回数', bodyweight: '自重×回数', time: '時間',
};

export function emptySet(): WorkoutSet {
  return { weight: null, reps: null, durationSec: null, rpe: null, warmup: false, note: '', done: false };
}

export function emptyCondition(): Condition {
  return { sleep: null, fatigue: null, motivation: null };
}

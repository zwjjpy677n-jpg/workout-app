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
  /** この種目のバー重量。null = 設定のバー重量。プレート図はこの値が非nullの種目だけに出す */
  barKg: number | null;
}

export interface RoutineItem {
  exerciseId: string;
  sets: number;
  /** 目標の表記（"5", "左右8", "8〜10", "6〜8本", "左右30秒"） */
  reps: string;
  main: boolean;
  /** 重量の上げ幅 kg */
  inc: number;
  note: string;
}

export interface Routine {
  id: string;
  name: string;
  /** 0=日 … 6=土。null = 曜日なし */
  weekday: number | null;
  items: RoutineItem[];
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
  /** ルーティンから始めたときの目標。自由に追加した種目は undefined */
  target?: EntryTarget;
  /** メイン種目「最後の回でスピードが落ちた」 */
  slowed?: boolean;
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
  routineId: string | null;
}

export interface BodyweightLog {
  /** 'YYYY-MM-DD' */
  date: string;
  kg: number;
  /** 体脂肪率 %。未入力・以前の記録は null（古いデータでは項目自体が無いこともある） */
  fatPct?: number | null;
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

export function defaultItem(exerciseId: string): RoutineItem {
  return { exerciseId, sets: 3, reps: '10', main: false, inc: 2.5, note: '' };
}

export function emptyCondition(): Condition {
  return { sleep: null, fatigue: null, motivation: null };
}

/** ルーティンから始めたときの目標のスナップショット */
export interface EntryTarget {
  sets: number;
  /** 目標の表記（"5", "左右8", "8〜10", "6〜8本", "左右30秒"） */
  reps: string;
  main: boolean;
  inc: number;
  note: string;
}

export interface TestResult {
  /** 'YYYY-MM-DD' */
  date: string;
  bodyweight: number | null;
  /** exerciseId → 5RM の重量 kg */
  lifts: Record<string, number>;
}

export interface Program {
  /** 'YYYY-MM-DD'。開始日が1週目の初日で、7日ごとに次の週 */
  startDate: string;
  tests: { start: TestResult | null; end: TestResult | null };
}

export const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];

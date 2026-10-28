import type { Exercise, WorkoutEntry } from './types';

/** その種目のレスト秒。メニューで決めたレストがあればそれ、無ければ種目の設定 */
export const restOf = (entry: WorkoutEntry, exercise: Exercise): number => entry.target?.restSec ?? exercise.restSec;

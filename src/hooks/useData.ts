import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getActiveWorkout, getProgram, getSettings, listBodyweights, listExercises, listRoutines, listWorkouts } from '../db/repository';
import type { Exercise } from '../lib/types';

export const useExercises = (includeArchived = false) => useLiveQuery(() => listExercises({ includeArchived }), [includeArchived]);
export const useRoutines = () => useLiveQuery(listRoutines);
export const useWorkouts = () => useLiveQuery(listWorkouts);
export const useActiveWorkout = () => useLiveQuery(async () => (await getActiveWorkout()) ?? null);
export const useBodyweights = () => useLiveQuery(listBodyweights);
export const useSettings = () => useLiveQuery(getSettings);

/** アーカイブ済みを含む全種目の id → Exercise */
export function useExerciseMap(): Map<string, Exercise> | undefined {
  const all = useExercises(true);
  return useMemo(() => (all ? new Map(all.map((e) => [e.id, e])) : undefined), [all]);
}

export const useProgram = () => useLiveQuery(async () => (await getProgram()) ?? null);

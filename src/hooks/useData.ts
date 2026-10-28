import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { feedbackForWorkouts, listFeedbackOut, listInbox } from '../db/feedback';
import { listMenuLog } from '../db/menus';
import { getFriend, getProfile, listFriends, listFriendWorkouts } from '../db/friends';
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

export const useProfile = () => useLiveQuery(getProfile);
export const useFriends = () => useLiveQuery(listFriends);
export const useFriend = (id: string) => useLiveQuery(async () => (await getFriend(id)) ?? null, [id]);
export const useFriendWorkouts = (id: string) => useLiveQuery(() => listFriendWorkouts(id), [id]);

export const useFeedbackOut = (friendId: string) => useLiveQuery(() => listFeedbackOut(friendId), [friendId]);
export const useInbox = () => useLiveQuery(listInbox);
export const useFeedbackForWorkouts = (ids: string[]) => useLiveQuery(() => feedbackForWorkouts(ids), [ids.join(',')]);
export const useMenuLog = (direction: 'sent' | 'received', friendId?: string) => useLiveQuery(() => listMenuLog(direction, friendId), [direction, friendId]);

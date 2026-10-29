import type { MenuPayload } from '../share/menuPayload';
import type { FriendRow, MenuMessage, OnlineUser, SharedWorkout, SharedWorkoutRow } from './types';

/** サーバーとの唯一の窓口。失敗は OnlineError で投げる */
export interface OnlineApi {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<OnlineUser>;
  currentUser(): Promise<OnlineUser | null>;
  signOut(): Promise<void>;
  getMyName(): Promise<string | null>;
  saveMyName(name: string): Promise<void>;
  createInvite(): Promise<string>;
  acceptInvite(code: string): Promise<FriendRow>;
  listFriends(): Promise<FriendRow[]>;
  upsertWorkout(w: SharedWorkout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  pullWorkouts(since: string): Promise<SharedWorkoutRow[]>;
  sendMenu(to: string, kind: 'built' | 'mine', body: MenuPayload): Promise<void>;
  pullMenus(since: string): Promise<MenuMessage[]>;
}

let testApi: OnlineApi | null = null;

export const setApiForTest = (api: OnlineApi | null) => {
  testApi = api;
};

// 本物（Supabase）の実装は Task 10 でここに足す。それまでは差し替えたものだけ返す
export const getApi = (): OnlineApi | null => testApi ?? null;

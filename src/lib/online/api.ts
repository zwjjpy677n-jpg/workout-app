import type { MenuPayload } from '../share/menuPayload';
import { isOnlineConfigured, ONLINE } from './config';
import { createSupabaseApi } from './supabaseApi';
import type { Comment, Emoji, FriendRow, GroupRow, MenuMessage, OnlineUser, Reaction, SharedWorkout, SharedWorkoutRow, WorkoutKey } from './types';

/** サーバーとの唯一の窓口。失敗は OnlineError で投げる */
export interface OnlineApi {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<OnlineUser>;
  currentUser(): Promise<OnlineUser | null>;
  signOut(): Promise<void>;
  getMyName(): Promise<string | null>;
  saveMyName(name: string): Promise<void>;
  createInvite(): Promise<string>;
  /** 友達の招待なら友達、グループの招待ならグループに入る。返すのは招待を作った人 */
  acceptInvite(code: string): Promise<FriendRow & { kind: 'friend' | 'group' }>;
  listFriends(): Promise<FriendRow[]>;
  upsertWorkout(w: SharedWorkout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  /** userId を渡すとその人の分だけ（あとから友達になった人の分を丸ごと取るとき） */
  pullWorkouts(since: string, userId?: string): Promise<SharedWorkoutRow[]>;
  sendMenu(to: string, kind: 'built' | 'mine', body: MenuPayload): Promise<void>;
  pullMenus(since: string): Promise<MenuMessage[]>;
  /** 自分が送ったメニュー（mid で探す）をサーバーから消す。無ければ何もしない */
  unsendMenu(mid: string): Promise<void>;
  /** 渡した id のうち、自分あてでまだサーバーにあるもの */
  existingMenus(ids: string[]): Promise<string[]>;

  createGroup(name: string): Promise<GroupRow>;
  /** 自分が入っているグループ */
  listGroups(): Promise<GroupRow[]>;
  renameGroup(id: string, name: string): Promise<void>;
  /** 抜ける。作った人が最後の 1 人ならグループごと消す */
  leaveGroup(id: string): Promise<void>;
  createGroupInvite(groupId: string): Promise<string>;
  groupMembers(groupId: string): Promise<FriendRow[]>;
  /** この人たちの、since 以降に終えた記録（削除済みは除く、新しい順） */
  recentWorkouts(userIds: string[], since: number): Promise<SharedWorkoutRow[]>;
  listReactions(keys: WorkoutKey[]): Promise<Reaction[]>;
  setReaction(key: WorkoutKey, emoji: Emoji, on: boolean): Promise<void>;
  listComments(keys: WorkoutKey[]): Promise<Comment[]>;
  addComment(key: WorkoutKey, body: string): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
}

let testApi: OnlineApi | null = null;

export const setApiForTest = (api: OnlineApi | null) => {
  testApi = api;
};

let real: OnlineApi | null = null;

/** 差し替えたものがあればそれ。無ければ、サーバーの設定がある版でだけ Supabase の窓口を 1 回だけ作って使い回す */
export const getApi = (): OnlineApi | null => {
  if (testApi) return testApi;
  if (!isOnlineConfigured()) return null;
  real ??= createSupabaseApi(ONLINE);
  return real;
};

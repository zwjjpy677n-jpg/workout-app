import type { MenuPayload } from '../share/menuPayload';
import type { SetTuple } from '../share/sharePayload';

export type SharedEntry = [x8: string, name: string, part: number, type: number, sets: SetTuple[]];
/** c: コンディション [睡眠, 疲労感, やる気]（1〜5、入れていなければ null）。前の版の記録には無い */
export type SharedCondition = [sleep: number | null, fatigue: number | null, motivation: number | null];
export type SharedBody = { e: SharedEntry[]; c?: SharedCondition };
export type SharedWorkout = { id: string; name: string; startedAt: number; endedAt: number; body: SharedBody };
export type SharedWorkoutRow = SharedWorkout & { userId: string; updatedAt: string; deleted: boolean };
export type MenuMessage = { id: string; sender: string; recipient: string; kind: 'built' | 'mine'; body: MenuPayload; createdAt: string };
/** anonymous: メールなしではじめた人（この端末のログインが消えると戻れない） */
export type OnlineUser = { userId: string; email: string; anonymous?: boolean };
export type FriendRow = { userId: string; name: string };
export type GroupRow = { id: string; name: string; owner: string };
export const EMOJIS = ['💪', '🔥', '👏'] as const;
export type Emoji = (typeof EMOJIS)[number];
/** 記録は (持ち主, 記録の id) で決まる */
export type WorkoutKey = { owner: string; id: string };
export type Reaction = WorkoutKey & { userId: string; emoji: Emoji };
export type Comment = WorkoutKey & { commentId: string; userId: string; body: string; createdAt: string };

export type OnlineErrorCode = 'offline' | 'auth' | 'code' | 'invalid' | 'expired' | 'used' | 'self' | 'unknown';

export class OnlineError extends Error {
  code: OnlineErrorCode;
  constructor(code: OnlineErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'OnlineError';
    this.code = code;
  }
}

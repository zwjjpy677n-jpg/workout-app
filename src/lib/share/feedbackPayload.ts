import { encodeShare, shareUrl } from './codec';
import { MAX_LINK } from './sharePayload';
import { arr, fail, id, int, nullable, str, tup } from './validate';

/** 書いたコメント（友達の記録へ）。workoutId / exerciseId は友達側の ID `${friendId}:${短いID}` */
export interface FeedbackOut {
  id: string;
  friendId: string;
  workoutId: string | null;
  /** 週へのひとこと: その週の月曜 'YYYY-MM-DD' */
  week: string | null;
  exerciseId: string | null;
  text: string;
  at: number;
  /** null = 未送信 */
  sentAt: number | null;
}

/** 届いたコメント（自分の記録へ）。workoutId / exerciseId は自分の記録・種目の ID（見つからなければ null） */
export interface FeedbackIn {
  id: string;
  friendId: string;
  friendName: string;
  workoutId: string | null;
  week: string | null;
  exerciseId: string | null;
  text: string;
  at: number;
  read: boolean;
}

export type FeedbackPayload = {
  id: string;
  n: string;
  to: string;
  at: number;
  c: [fid: string, wid8: string | null, week: string | null, xid8: string | null, text: string, at: number][];
};

export const COMMENT_MAX = 300;
export const COMMENTS_PER_LINK = 50;
const min = (ms: number) => Math.floor(ms / 60000);
/** `${friendId}:${短いID}` の短いIDの部分 */
const short = (v: string | null) => (v == null ? null : v.slice(v.indexOf(':') + 1));
const isWeek = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fail());

export function parseFeedbackPayload(data: unknown): FeedbackPayload {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) fail();
  const d = data as Record<string, unknown>;
  return {
    id: id(d.id),
    n: str(d.n, 1, 40),
    to: id(d.to),
    at: int(d.at, 0, Number.MAX_SAFE_INTEGER),
    c: arr(d.c, COMMENTS_PER_LINK).map((e): FeedbackPayload['c'][number] => {
      const [fid, w8, week, x8, text, at] = tup(e, 6);
      const row: FeedbackPayload['c'][number] = [id(fid), nullable(w8, id), nullable(week, isWeek), nullable(x8, id), str(text, 1, COMMENT_MAX), int(at, 0, Number.MAX_SAFE_INTEGER)];
      if (row[1] == null && row[2] == null) fail();
      return row;
    }),
  };
}

/** 古いコメントから、リンクが長すぎない分だけ入れる */
export async function buildFeedbackLink(from: { id: string; name: string }, to: string, comments: FeedbackOut[], now: number) {
  const sorted = [...comments].sort((a, b) => a.at - b.at).slice(0, COMMENTS_PER_LINK);
  const rows = sorted.map((x): FeedbackPayload['c'][number] => [x.id, short(x.workoutId), x.week, short(x.exerciseId), x.text, min(x.at)]);
  let best: { link: string; n: number } | null = null;
  for (let n = 1; n <= rows.length; n++) {
    const p: FeedbackPayload = { id: from.id, n: from.name, to, at: min(now), c: rows.slice(0, n) };
    const link = shareUrl(await encodeShare('f', p));
    if (link.length > MAX_LINK) break;
    best = { link, n };
  }
  const n = best?.n ?? 0;
  const text = best ? `GRIND のフィードバックです（${n}件）。GRIND の『友達』タブに貼り付けてね\n${best.link}` : '';
  return { text, sent: sorted.slice(0, n).map((x) => x.id), rest: comments.length - n };
}

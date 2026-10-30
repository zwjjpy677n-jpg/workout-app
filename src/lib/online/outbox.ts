import { db } from '../../db/db';
import type { MenuPayload } from '../share/menuPayload';
import { getApi } from './api';
import { getAutoShare, getOutboxOwner, getSession, setOutboxOwner, setSession } from './prefs';
import { toSharedWorkout } from './sharedWorkout';
import { OnlineError } from './types';

export type OutboxItem =
  | { id: string; kind: 'workout'; workoutId: string; op: 'upsert' | 'delete'; at: number }
  | { id: string; kind: 'menu'; to: string; menuKind: 'built' | 'mine'; body: MenuPayload; at: number };

let seq = 0;
/** 同じミリ秒でも順番が入れ替わらないように、小さな連番を足す */
const stampAt = () => Date.now() + (seq = (seq + 1) % 1000) / 1000;

/** 一度サーバーへ送った記録の印（sync の 'sent:<記録の id>'） */
const sentKey = (workoutId: string) => `sent:${workoutId}`;

/**
 * 記録の送り予定を入れる。新しい記録はログイン中かつ自動共有オンのときだけ。
 * すでに送った（または送る予定の）記録の直し・削除は、自動共有オフ・ログアウト中でも入れる（友達の端末に古い分が残らないように）
 */
export async function queueWorkout(workoutId: string, op: 'upsert' | 'delete'): Promise<void> {
  const known = (await db.sync.get(sentKey(workoutId))) !== undefined || (await db.outbox.get(`w:${workoutId}`)) !== undefined;
  if (!known && (!getSession() || !getAutoShare())) return;
  await db.outbox.put({ id: `w:${workoutId}`, kind: 'workout', workoutId, op, at: stampAt() });
  if (getSession()) flushOutbox().catch(() => {});
}

export async function queueMenu(to: string, menuKind: 'built' | 'mine', body: MenuPayload): Promise<string> {
  const id = `m:${crypto.randomUUID()}`;
  await db.outbox.put({ id, kind: 'menu', to, menuKind, body, at: stampAt() });
  flushOutbox().catch(() => {});
  return id;
}

/** 直近 days 日に始めた、終わった記録をまとめて入れる。入れた件数を返す（送りは flushOutbox） */
export async function queueRecentWorkouts(now: number, days = 56): Promise<number> {
  const since = now - days * 86_400_000;
  const list = await db.workouts.where('startedAt').aboveOrEqual(since).toArray();
  const done = list.filter((w) => w.endedAt != null);
  await db.outbox.bulkPut(done.map((w): OutboxItem => ({ id: `w:${w.id}`, kind: 'workout', workoutId: w.id, op: 'upsert', at: stampAt() })));
  return done.length;
}

/** 前の人の分として消す sync のキー（友達の記録・既読の位置は残す） */
const PER_USER_SYNC = ['workoutsSince', 'menusSince', 'pulledFriends'];

/**
 * 送り予定と同期の位置を userId のものにする。前に別の人のものだったら、送り予定・同期の位置・送った印を消す
 * （同じ端末で別の人がログインしたとき、前の人の分を新しい人の名前で送らない／新しい人の友達を丸ごと取り直す）
 */
export async function claimOutbox(userId: string): Promise<void> {
  const owner = getOutboxOwner();
  if (owner === userId) return;
  if (owner !== null) {
    await db.transaction('rw', db.outbox, db.sync, async () => {
      await db.outbox.clear();
      await db.sync.bulkDelete(PER_USER_SYNC);
      await db.sync.where('key').startsWith('sent:').delete();
    });
  }
  setOutboxOwner(userId);
}

let inflight: Promise<'done' | 'offline' | 'skipped'> | null = null;

/** 送ったメニューを取り消す。まだ送っていない分は outbox から外し、送った分はサーバーから消す（つながらなければ OnlineError） */
export async function unsendMenu(mid: string): Promise<void> {
  const queued = await db.outbox.filter((i) => i.kind === 'menu' && i.body.mid === mid).delete();
  const api = getApi();
  if (!api || !getSession()) {
    if (queued) return;
    throw new OnlineError('auth');
  }
  // 送っている途中の分は、届き終わってから消す
  await inflight?.catch(() => undefined);
  // outbox にあった分はまだ届いていないので、サーバーに消しに行けなくても取り消せている
  await api.unsendMenu(mid).catch((e: unknown) => {
    if (!queued) throw e;
  });
}

/** 古い順に送り、成功した分を消す。同時には 1 つだけ動く */
export function flushOutbox(): Promise<'done' | 'offline' | 'skipped'> {
  inflight ??= run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run(): Promise<'done' | 'offline' | 'skipped'> {
  const api = getApi();
  const session = getSession();
  if (!api || !session) return 'skipped';
  await claimOutbox(session.userId);
  const tried = new Set<string>();
  for (;;) {
    const items = (await db.outbox.toArray()).sort((a, b) => a.at - b.at).filter((i) => !tried.has(`${i.id}@${i.at}`));
    if (!items.length) return 'done';
    for (const item of items) {
      tried.add(`${item.id}@${item.at}`);
      let done: 'upsert' | 'delete' | 'menu';
      try {
        done = await send(api, item, () => getSession()?.userId === session.userId);
      } catch (e) {
        if (e === SWITCHED) return 'skipped';
        if (e instanceof OnlineError && e.code === 'offline') return 'offline';
        if (e instanceof OnlineError && e.code === 'auth') {
          setSession(null);
          return 'skipped';
        }
        // 相手が見つからない等、直らない失敗で全体を止めない。この項目は残して次へ
        continue;
      }
      if (item.kind === 'workout') {
        if (done === 'upsert') await db.sync.put({ key: sentKey(item.workoutId), value: 1 });
        else await db.sync.delete(sentKey(item.workoutId));
      }
      // 送っている間に上書きされていたら残す（次の周回で送る）
      await db.outbox.where('id').equals(item.id).and((x) => x.at === item.at).delete();
    }
  }
}

/** 送っている途中でログインが外れた・別の人になった */
const SWITCHED = new Error('switched');

/** 送って、実際にした操作を返す（記録が端末に無ければ upsert でも削除を送る）。送る直前に same() で同じ人のままか確かめる */
async function send(api: NonNullable<ReturnType<typeof getApi>>, item: OutboxItem, same: () => boolean): Promise<'upsert' | 'delete' | 'menu'> {
  const check = () => {
    if (!same()) throw SWITCHED;
  };
  if (item.kind === 'menu') {
    check();
    await api.sendMenu(item.to, item.menuKind, item.body);
    return 'menu';
  }
  if (item.op === 'upsert') {
    const w = await db.workouts.get(item.workoutId);
    const shared = w ? toSharedWorkout(w, new Map((await db.exercises.toArray()).map((e) => [e.id, e]))) : null;
    if (shared) {
      check();
      await api.upsertWorkout(shared);
      return 'upsert';
    }
  }
  check();
  await api.deleteWorkout(item.workoutId);
  return 'delete';
}

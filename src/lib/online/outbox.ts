import { db } from '../../db/db';
import type { MenuPayload } from '../share/menuPayload';
import { getApi } from './api';
import { getAutoShare, getSession, setSession } from './prefs';
import { toSharedWorkout } from './sharedWorkout';
import { OnlineError } from './types';

export type OutboxItem =
  | { id: string; kind: 'workout'; workoutId: string; op: 'upsert' | 'delete'; at: number }
  | { id: string; kind: 'menu'; to: string; menuKind: 'built' | 'mine'; body: MenuPayload; at: number };

let seq = 0;
/** 同じミリ秒でも順番が入れ替わらないように、小さな連番を足す */
const stampAt = () => Date.now() + (seq = (seq + 1) % 1000) / 1000;

export async function queueWorkout(workoutId: string, op: 'upsert' | 'delete'): Promise<void> {
  if (!getSession() || !getAutoShare()) return;
  await db.outbox.put({ id: `w:${workoutId}`, kind: 'workout', workoutId, op, at: stampAt() });
  void flushOutbox();
}

export async function queueMenu(to: string, menuKind: 'built' | 'mine', body: MenuPayload): Promise<string> {
  const id = `m:${crypto.randomUUID()}`;
  await db.outbox.put({ id, kind: 'menu', to, menuKind, body, at: stampAt() });
  void flushOutbox();
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

let inflight: Promise<'done' | 'offline' | 'skipped'> | null = null;

/** 古い順に送り、成功した分を消す。同時には 1 つだけ動く */
export function flushOutbox(): Promise<'done' | 'offline' | 'skipped'> {
  inflight ??= run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run(): Promise<'done' | 'offline' | 'skipped'> {
  const api = getApi();
  if (!api || !getSession()) return 'skipped';
  const tried = new Set<string>();
  for (;;) {
    const items = (await db.outbox.toArray()).sort((a, b) => a.at - b.at).filter((i) => !tried.has(`${i.id}@${i.at}`));
    if (!items.length) return 'done';
    for (const item of items) {
      tried.add(`${item.id}@${item.at}`);
      try {
        await send(api, item);
      } catch (e) {
        if (e instanceof OnlineError && e.code === 'offline') return 'offline';
        if (e instanceof OnlineError && e.code === 'auth') {
          setSession(null);
          return 'skipped';
        }
        // 相手が見つからない等、直らない失敗で全体を止めない。この項目は残して次へ
        continue;
      }
      // 送っている間に上書きされていたら残す（次の周回で送る）
      await db.outbox.where('id').equals(item.id).and((x) => x.at === item.at).delete();
    }
  }
}

async function send(api: NonNullable<ReturnType<typeof getApi>>, item: OutboxItem): Promise<void> {
  if (item.kind === 'menu') return api.sendMenu(item.to, item.menuKind, item.body);
  if (item.op === 'upsert') {
    const w = await db.workouts.get(item.workoutId);
    const shared = w ? toSharedWorkout(w, new Map((await db.exercises.toArray()).map((e) => [e.id, e]))) : null;
    if (shared) return api.upsertWorkout(shared);
  }
  return api.deleteWorkout(item.workoutId);
}

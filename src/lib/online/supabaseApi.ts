import { createClient } from '@supabase/supabase-js';
import type { MenuPayload } from '../share/menuPayload';
import type { OnlineApi } from './api';
import { OnlineError, type FriendRow, type MenuMessage, type OnlineErrorCode, type OnlineUser, type SharedBody, type SharedWorkout, type SharedWorkoutRow } from './types';

type Raw = { name?: unknown; message?: unknown; code?: unknown; status?: unknown } | null | undefined;

const OFFLINE_RE = /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet_disconnected|the internet connection appears to be offline/i;
const AUTH_RE = /jwt expired|invalid jwt|jwt.*(malformed|invalid)|auth session missing|invalid refresh token|refresh token not found/i;
const INVITE_CODES: OnlineErrorCode[] = ['invalid', 'expired', 'used', 'self'];

/** supabase-js の失敗（エラーの値、投げられた例外、レスポンスの status）を OnlineError に直す */
export function toOnlineError(e: unknown, status?: number): OnlineError {
  if (e instanceof OnlineError) return e;
  const r = (typeof e === 'object' ? e : { message: String(e) }) as Raw;
  const name = typeof r?.name === 'string' ? r.name : '';
  const message = typeof r?.message === 'string' ? r.message : '';
  const code = typeof r?.code === 'string' ? r.code : '';
  const st = typeof r?.status === 'number' ? r.status : status;
  if (name === 'AuthRetryableFetchError' || st === 0 || OFFLINE_RE.test(message) || (e instanceof TypeError && !code)) {
    return new OnlineError('offline', message || undefined);
  }
  if (st === 401 || code === 'PGRST301' || code === 'PGRST303' || name === 'AuthSessionMissingError' || AUTH_RE.test(message)) {
    return new OnlineError('auth', message || undefined);
  }
  if (code === '42501') return new OnlineError('invalid', message);
  return new OnlineError('unknown', message || undefined);
}

type Result<T> = { data: T | null; error: unknown; status?: number };

/** 失敗なら投げ、成功なら data を返す */
async function run<T>(p: PromiseLike<Result<T>>): Promise<T | null> {
  let res: Result<T>;
  try {
    res = await p;
  } catch (e) {
    throw toOnlineError(e);
  }
  if (res.error) throw toOnlineError(res.error, res.status);
  return res.data;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (v: unknown) => (typeof v === 'number' ? v : Date.parse(String(v)));

type WorkoutDbRow = { user_id: string; id: string; name: string; started_at: string; ended_at: string; body: SharedBody; updated_at: string; deleted: boolean };
type MenuDbRow = { id: string; sender: string; recipient: string; kind: 'built' | 'mine'; body: MenuPayload; created_at: string };

export function createSupabaseApi(cfg: { url: string; anonKey: string }): OnlineApi {
  // セッションは localStorage に残す。HashRouter が URL の # を使うので、メールの URL からのログインは見ない
  const sb = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const sessionUser = async (): Promise<OnlineUser | null> => {
    let res;
    try {
      res = await sb.auth.getSession();
    } catch (e) {
      throw toOnlineError(e);
    }
    if (res.error) throw toOnlineError(res.error);
    const u = res.data.session?.user;
    return u ? { userId: u.id, email: u.email ?? '' } : null;
  };
  const me = async (): Promise<string> => {
    const u = await sessionUser();
    if (!u) throw new OnlineError('auth');
    return u.userId;
  };

  return {
    async sendCode(email) {
      await run(sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }));
    },

    async verifyCode(email, code) {
      let res;
      try {
        res = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      } catch (e) {
        throw toOnlineError(e);
      }
      if (res.error) {
        const err = toOnlineError(res.error);
        // 通信の失敗と送りすぎ（429）はそのまま。それ以外（間違い・期限切れ）はコードの問題
        if (err.code === 'offline' || (res.error as { status?: unknown }).status === 429) throw err;
        throw new OnlineError('code', err.message);
      }
      const u = res.data.user;
      if (!u) throw new OnlineError('code');
      return { userId: u.id, email: u.email ?? email.trim() };
    },

    currentUser: sessionUser,

    async signOut() {
      await run(sb.auth.signOut({ scope: 'local' }).then((r) => ({ data: null, error: r.error })));
    },

    async getMyName() {
      const uid = await me();
      const row = await run(sb.from('profiles').select('name').eq('id', uid).maybeSingle());
      return (row as { name?: string } | null)?.name ?? null;
    },

    async saveMyName(name) {
      const uid = await me();
      await run(sb.from('profiles').upsert({ id: uid, name }));
    },

    async createInvite() {
      await me();
      const code = await run(sb.rpc('create_invite', { kind: 'friend' }));
      if (typeof code !== 'string' || !code) throw new OnlineError('unknown');
      return code;
    },

    async acceptInvite(code) {
      await me();
      let data;
      try {
        data = await run(sb.rpc('accept_invite', { code }));
      } catch (e) {
        const err = e as OnlineError;
        const hit = INVITE_CODES.find((c) => err.message.trim() === c);
        if (err.code !== 'offline' && err.code !== 'auth' && hit) throw new OnlineError(hit);
        throw err;
      }
      const r = data as { user_id?: string; name?: string | null } | null;
      if (!r?.user_id) throw new OnlineError('unknown');
      return { userId: r.user_id, name: r.name ?? '' };
    },

    async listFriends() {
      const uid = await me();
      const pairs = ((await run(sb.from('friendships').select('user_a,user_b').or(`user_a.eq.${uid},user_b.eq.${uid}`))) ?? []) as { user_a: string; user_b: string }[];
      const others = [...new Set(pairs.map((p) => (p.user_a === uid ? p.user_b : p.user_a)).filter((id) => id !== uid))];
      if (!others.length) return [];
      const profiles = ((await run(sb.from('profiles').select('id,name').in('id', others))) ?? []) as { id: string; name: string }[];
      // 読めない相手（ブロックなど）は profiles に出てこないので、友達一覧にも出さない
      const names = new Map(profiles.map((p) => [p.id, p.name]));
      return others.filter((id) => names.has(id)).map((id): FriendRow => ({ userId: id, name: names.get(id) ?? '' }));
    },

    async upsertWorkout(w: SharedWorkout) {
      const uid = await me();
      await run(
        sb.from('shared_workouts').upsert(
          { user_id: uid, id: w.id, name: w.name, started_at: iso(w.startedAt), ended_at: iso(w.endedAt), body: w.body, deleted: false },
          { onConflict: 'user_id,id' },
        ),
      );
    },

    async deleteWorkout(id) {
      const uid = await me();
      await run(sb.from('shared_workouts').update({ deleted: true }).eq('user_id', uid).eq('id', id));
    },

    async pullWorkouts(since, userId) {
      const uid = await me();
      let q = sb.from('shared_workouts').select('user_id,id,name,started_at,ended_at,body,updated_at,deleted').neq('user_id', uid);
      if (userId) q = q.eq('user_id', userId);
      if (since) q = q.gt('updated_at', since);
      const rows = ((await run(q.order('updated_at', { ascending: true }))) ?? []) as WorkoutDbRow[];
      return rows.map(
        (r): SharedWorkoutRow => ({
          userId: r.user_id,
          id: r.id,
          name: r.name,
          startedAt: ms(r.started_at),
          endedAt: ms(r.ended_at),
          body: r.body,
          updatedAt: r.updated_at,
          deleted: r.deleted,
        }),
      );
    },

    async sendMenu(to, kind, body) {
      const uid = await me();
      await run(sb.from('menu_messages').insert({ sender: uid, recipient: to, kind, body }));
    },

    async pullMenus(since) {
      const uid = await me();
      // 送った人も自分の送った分を読めるので、自分あてだけに絞る
      let q = sb.from('menu_messages').select('id,sender,recipient,kind,body,created_at').eq('recipient', uid);
      if (since) q = q.gt('created_at', since);
      const rows = ((await run(q.order('created_at', { ascending: true }))) ?? []) as MenuDbRow[];
      return rows.map((m): MenuMessage => ({ id: m.id, sender: m.sender, recipient: m.recipient, kind: m.kind, body: m.body, createdAt: m.created_at }));
    },
  };
}

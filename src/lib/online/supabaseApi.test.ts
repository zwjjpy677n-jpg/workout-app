import { createClient } from '@supabase/supabase-js';
import type { MenuPayload } from '../share/menuPayload';
import { createSupabaseApi } from './supabaseApi';
import { OnlineError, type SharedWorkout } from './types';

type Res = { data?: unknown; error?: unknown; status?: number };
type Call = [string, ...unknown[]];

let calls: Call[] = [];
let results: Res[] = [];
let session: { user: { id: string; email?: string } } | null = { user: { id: 'me', email: 'me@example.com' } };

const next = () => {
  const r = results.shift() ?? {};
  return { data: r.data ?? null, error: r.error ?? null, status: r.status ?? 200 };
};

const builder = () => {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte', 'in', 'or', 'order', 'limit', 'maybeSingle', 'single']) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return b;
    };
  }
  b.then = (ok: (v: unknown) => unknown, ng: (e: unknown) => unknown) => Promise.resolve(next()).then(ok, ng);
  return b;
};

const auth = {
  getSession: vi.fn(async () => ({ data: { session }, error: null })),
  signInWithOtp: vi.fn(async (_: unknown) => ({ data: {}, error: null as unknown })),
  signInAnonymously: vi.fn(async () => ({ data: { user: { id: 'anon1', is_anonymous: true } as unknown, session: null }, error: null as unknown })),
  verifyOtp: vi.fn(async (_: unknown) => ({ data: { user: null as unknown, session: null }, error: null as unknown })),
  signOut: vi.fn(async (_?: unknown) => ({ error: null as unknown })),
};

const client = {
  from: (t: string) => {
    calls.push(['from', t]);
    return builder();
  },
  rpc: (fn: string, args: unknown) => {
    calls.push(['rpc', fn, args]);
    return builder();
  },
  auth,
};

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => client) }));

const api = () => createSupabaseApi({ url: 'https://x.supabase.co', anonKey: 'anon' });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(OnlineError);
    return (e as OnlineError).code;
  }
  throw new Error('投げなかった');
};

const W: SharedWorkout = { id: 'w1', name: '胸の日', startedAt: Date.UTC(2026, 9, 1, 10), endedAt: Date.UTC(2026, 9, 1, 11), body: { e: [] } };

beforeEach(() => {
  calls = [];
  results = [];
  session = { user: { id: 'me', email: 'me@example.com' } };
  vi.clearAllMocks();
});

test('ログインはメールの URL を見ず、端末に残す設定で作る', () => {
  api();
  expect(createClient).toHaveBeenCalledWith('https://x.supabase.co', 'anon', {
    auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }),
  });
});

test('通信の失敗は offline', async () => {
  for (const message of ['TypeError: Failed to fetch', 'TypeError: NetworkError when attempting to fetch resource.', 'TypeError: Load failed']) {
    results = [{ error: { message, details: '', hint: '', code: '' }, status: 0 }];
    expect(await code(api().upsertWorkout(W))).toBe('offline');
  }
  auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } });
  expect(await code(api().sendCode('a@example.com'))).toBe('offline');
  auth.signInWithOtp.mockRejectedValueOnce(new TypeError('Load failed'));
  expect(await code(api().sendCode('a@example.com'))).toBe('offline');
});

test('JWT の期限切れや 401 は auth', async () => {
  results = [{ error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 }];
  expect(await code(api().pullWorkouts(''))).toBe('auth');
  results = [{ error: { message: 'invalid JWT', code: '' }, status: 400 }];
  expect(await code(api().pullMenus(''))).toBe('auth');
});

test('ログインしていなければ auth で、サーバーには聞かない', async () => {
  session = null;
  expect(await code(api().upsertWorkout(W))).toBe('auth');
  expect(calls).toEqual([]);
  expect(await api().currentUser()).toBeNull();
});

test('ほかの失敗は unknown', async () => {
  results = [{ error: { message: 'boom', code: 'XX000' }, status: 500 }];
  expect(await code(api().getMyName())).toBe('unknown');
});

test('OTP の間違いは code', async () => {
  auth.verifyOtp.mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' },
  });
  expect(await code(api().verifyCode('a@example.com', '000000'))).toBe('code');
  auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } });
  expect(await code(api().verifyCode('a@example.com', '000000'))).toBe('offline');
});

test('verifyCode は email の OTP で確かめ、ユーザーを返す', async () => {
  auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@example.com' }, session: null }, error: null });
  expect(await api().verifyCode(' a@example.com ', '123456')).toEqual({ userId: 'u1', email: 'a@example.com' });
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@example.com', token: '123456', type: 'email' });
});

test('sendCode はメールにコードを送る', async () => {
  await api().sendCode('a@example.com');
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@example.com', options: { shouldCreateUser: true } });
});

test('currentUser は端末のログインから返す', async () => {
  expect(await api().currentUser()).toEqual({ userId: 'me', email: 'me@example.com' });
});

test('accept_invite の expired は expired', async () => {
  for (const c of ['expired', 'invalid', 'used', 'self'] as const) {
    results = [{ error: { message: c, code: 'P0001' }, status: 400 }];
    expect(await code(api().acceptInvite('abc'))).toBe(c);
  }
});

test('acceptInvite は招待した人を友達として返す', async () => {
  results = [{ data: { kind: 'friend', user_id: 'u2', name: 'たろう' } }];
  expect(await api().acceptInvite('abc')).toEqual({ userId: 'u2', name: 'たろう', kind: 'friend' });
  results = [{ data: { kind: 'group', user_id: 'u3', name: 'はなこ' } }];
  expect(await api().acceptInvite('def')).toEqual({ userId: 'u3', name: 'はなこ', kind: 'group' });
  expect(calls).toContainEqual(['rpc', 'accept_invite', { code: 'abc' }]);
});

test('createInvite は友達の招待コードを作る', async () => {
  results = [{ data: 'CODE' }];
  expect(await api().createInvite()).toBe('CODE');
  expect(calls).toContainEqual(['rpc', 'create_invite', { kind: 'friend' }]);
});

test('名前は profiles の自分の行に読み書きする', async () => {
  results = [{ data: { name: 'じろう' } }, {}];
  const a = api();
  expect(await a.getMyName()).toBe('じろう');
  expect(calls).toContainEqual(['eq', 'id', 'me']);
  await a.saveMyName('さぶろう');
  expect(calls).toContainEqual(['upsert', { id: 'me', name: 'さぶろう' }]);
});

test('upsertWorkout は shared_workouts に user_id 付きで upsert する', async () => {
  await api().upsertWorkout(W);
  expect(calls[0]).toEqual(['from', 'shared_workouts']);
  expect(calls).toContainEqual([
    'upsert',
    { user_id: 'me', id: 'w1', name: '胸の日', started_at: '2026-10-01T10:00:00.000Z', ended_at: '2026-10-01T11:00:00.000Z', body: { e: [] }, deleted: false },
    { onConflict: 'user_id,id' },
  ]);
});

test('deleteWorkout は自分の記録に削除の印をつける', async () => {
  await api().deleteWorkout('w1');
  expect(calls).toEqual([
    ['from', 'shared_workouts'],
    ['update', { deleted: true }],
    ['eq', 'user_id', 'me'],
    ['eq', 'id', 'w1'],
  ]);
});

test('pullWorkouts は自分の分を除き、since より新しいものを古い順に取る', async () => {
  results = [
    {
      data: [
        { user_id: 'u2', id: 'w9', name: '脚', started_at: '2026-10-01T10:00:00+00:00', ended_at: '2026-10-01T11:00:00+00:00', body: { e: [] }, updated_at: '2026-10-02T00:00:00.123456+00:00', deleted: false },
      ],
    },
  ];
  const rows = await api().pullWorkouts('2026-10-01T00:00:00+00:00');
  expect(rows).toEqual([
    { userId: 'u2', id: 'w9', name: '脚', startedAt: Date.UTC(2026, 9, 1, 10), endedAt: Date.UTC(2026, 9, 1, 11), body: { e: [] }, updatedAt: '2026-10-02T00:00:00.123456+00:00', deleted: false },
  ]);
  expect(calls).toContainEqual(['from', 'shared_workouts']);
  expect(calls).toContainEqual(['neq', 'user_id', 'me']);
  expect(calls).toContainEqual(['gt', 'updated_at', '2026-10-01T00:00:00+00:00']);
  expect(calls).toContainEqual(['order', 'updated_at', { ascending: true }]);
});

test('pullWorkouts の since が空なら全部取る', async () => {
  results = [{ data: [] }];
  expect(await api().pullWorkouts('')).toEqual([]);
  expect(calls.some((c) => c[0] === 'gt')).toBe(false);
});

test('pullWorkouts に userId を渡すと、その人の分だけ取る', async () => {
  results = [{ data: [] }];
  await api().pullWorkouts('', 'u3');
  expect(calls).toContainEqual(['eq', 'user_id', 'u3']);
  calls = [];
  results = [{ data: [] }];
  await api().pullWorkouts('');
  expect(calls.some((c) => c[0] === 'eq')).toBe(false);
});

test('pullMenus は自分あての分だけ取る', async () => {
  const body = { name: 'm' } as unknown as MenuPayload;
  results = [{ data: [{ id: 'x', sender: 'u2', recipient: 'me', kind: 'built', body, created_at: '2026-10-02T00:00:00+00:00' }] }];
  expect(await api().pullMenus('2026-10-01T00:00:00+00:00')).toEqual([
    { id: 'x', sender: 'u2', recipient: 'me', kind: 'built', body, createdAt: '2026-10-02T00:00:00+00:00' },
  ]);
  expect(calls).toContainEqual(['from', 'menu_messages']);
  expect(calls).toContainEqual(['eq', 'recipient', 'me']);
  expect(calls).toContainEqual(['gt', 'created_at', '2026-10-01T00:00:00+00:00']);
  expect(calls).toContainEqual(['order', 'created_at', { ascending: true }]);
});

test('sendMenu は自分を送り主にして入れる。友達でなければ invalid', async () => {
  const body = { name: 'm' } as unknown as MenuPayload;
  await api().sendMenu('u2', 'mine', body);
  expect(calls).toContainEqual(['insert', { sender: 'me', recipient: 'u2', kind: 'mine', body }]);
  results = [{ error: { message: 'new row violates row-level security policy for table "menu_messages"', code: '42501' }, status: 403 }];
  expect(await code(api().sendMenu('u3', 'mine', body))).toBe('invalid');
});

test('unsendMenu は自分が送った同じ mid の行を消す', async () => {
  await api().unsendMenu('mid123');
  expect(calls).toContainEqual(['from', 'menu_messages']);
  expect(calls).toContainEqual(['delete']);
  expect(calls).toContainEqual(['eq', 'sender', 'me']);
  expect(calls).toContainEqual(['eq', 'body->>mid', 'mid123']);
});

test('existingMenus は自分あてでまだある id を返す。空なら問い合わせない', async () => {
  expect(await api().existingMenus([])).toEqual([]);
  expect(calls).toEqual([]);
  results = [{ data: [{ id: 'x' }] }];
  expect(await api().existingMenus(['x', 'y'])).toEqual(['x']);
  expect(calls).toContainEqual(['eq', 'recipient', 'me']);
  expect(calls).toContainEqual(['in', 'id', ['x', 'y']]);
});

test('listFriends は自分の友達関係の相手の名前を返す（読めない相手は出さない）', async () => {
  results = [
    { data: [{ user_a: 'a1', user_b: 'me' }, { user_a: 'me', user_b: 'z9' }, { user_a: 'b2', user_b: 'me' }] },
    { data: [{ id: 'a1', name: 'あ' }, { id: 'z9', name: 'ぜ' }] },
  ];
  expect(await api().listFriends()).toEqual([
    { userId: 'a1', name: 'あ' },
    { userId: 'z9', name: 'ぜ' },
  ]);
  expect(calls).toContainEqual(['from', 'friendships']);
  expect(calls).toContainEqual(['or', 'user_a.eq.me,user_b.eq.me']);
  expect(calls).toContainEqual(['from', 'profiles']);
  expect(calls).toContainEqual(['in', 'id', ['a1', 'z9', 'b2']]);
});

test('友達がいなければ profiles は読まない', async () => {
  results = [{ data: [] }];
  expect(await api().listFriends()).toEqual([]);
  expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'friendships']]);
});

test('signOut は端末のログインを外す', async () => {
  await api().signOut();
  expect(auth.signOut).toHaveBeenCalled();
});

test('createGroup はグループを作り、自分をメンバーに入れる', async () => {
  results = [{ data: { id: 'g1', name: '朝練', owner: 'me' } }, {}];
  expect(await api().createGroup('朝練')).toEqual({ id: 'g1', name: '朝練', owner: 'me' });
  expect(calls).toContainEqual(['insert', { name: '朝練', owner: 'me' }]);
  expect(calls).toContainEqual(['insert', { group_id: 'g1', user_id: 'me' }]);
});

test('listGroups は自分が入っているグループだけ。入っていなければ groups を読まない', async () => {
  results = [{ data: [] }];
  expect(await api().listGroups()).toEqual([]);
  expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'group_members']]);
  calls = [];
  results = [{ data: [{ group_id: 'g1' }] }, { data: [{ id: 'g1', name: '朝練', owner: 'u2' }] }];
  expect(await api().listGroups()).toEqual([{ id: 'g1', name: '朝練', owner: 'u2' }]);
  expect(calls).toContainEqual(['eq', 'user_id', 'me']);
  expect(calls).toContainEqual(['in', 'id', ['g1']]);
});

test('leaveGroup：ほかにメンバーがいれば自分だけ抜け、作った人が最後の1人ならグループを消す', async () => {
  results = [{ data: { owner: 'me' } }, { data: [{ user_id: 'u2' }] }, {}];
  await api().leaveGroup('g1');
  expect(calls).toContainEqual(['from', 'group_members']);
  expect(calls).toContainEqual(['eq', 'user_id', 'me']);
  expect(calls.filter((c) => c[0] === 'from').map((c) => c[1])).toEqual(['groups', 'group_members', 'group_members']);
  calls = [];
  results = [{ data: { owner: 'me' } }, { data: [] }, {}];
  await api().leaveGroup('g1');
  expect(calls.filter((c) => c[0] === 'from').map((c) => c[1])).toEqual(['groups', 'group_members', 'groups']);
  expect(calls.filter((c) => c[0] === 'delete')).toHaveLength(1);
});

test('createGroupInvite はグループの招待コードを作る', async () => {
  results = [{ data: 'GCODE' }];
  expect(await api().createGroupInvite('g1')).toBe('GCODE');
  expect(calls).toContainEqual(['rpc', 'create_invite', { kind: 'group', group_id: 'g1' }]);
});

test('groupMembers は入った順に、読める人だけ名前つきで返す', async () => {
  results = [{ data: [{ user_id: 'me' }, { user_id: 'u2' }, { user_id: 'u9' }] }, { data: [{ id: 'u2', name: 'に' }, { id: 'me', name: 'わたし' }] }];
  expect(await api().groupMembers('g1')).toEqual([{ userId: 'me', name: 'わたし' }, { userId: 'u2', name: 'に' }]);
  expect(calls).toContainEqual(['order', 'joined_at', { ascending: true }]);
});

test('recentWorkouts は削除されていない最近の記録を新しい順に。だれもいなければ問い合わせない', async () => {
  expect(await api().recentWorkouts([], 0)).toEqual([]);
  expect(calls).toEqual([]);
  results = [{ data: [{ user_id: 'u2', id: 'w1', name: '脚', started_at: '2026-10-01T00:00:00Z', ended_at: '2026-10-01T01:00:00Z', body: { e: [] }, updated_at: 'x', deleted: false }] }];
  const rows = await api().recentWorkouts(['me', 'u2'], Date.parse('2026-09-01T00:00:00Z'));
  expect(rows[0]).toMatchObject({ userId: 'u2', id: 'w1', endedAt: Date.parse('2026-10-01T01:00:00Z') });
  expect(calls).toContainEqual(['in', 'user_id', ['me', 'u2']]);
  expect(calls).toContainEqual(['eq', 'deleted', false]);
  expect(calls).toContainEqual(['gte', 'ended_at', '2026-09-01T00:00:00.000Z']);
  expect(calls).toContainEqual(['order', 'ended_at', { ascending: false }]);
});

test('リアクション：読むときは頼んだ記録の分だけ、付ける・外すは自分の分', async () => {
  results = [{ data: [
    { workout_owner: 'u2', workout_id: 'w1', user_id: 'u3', emoji: '💪' },
    { workout_owner: 'u2', workout_id: 'w9', user_id: 'u3', emoji: '🔥' },
    { workout_owner: 'u2', workout_id: 'w1', user_id: 'u3', emoji: '😀' },
  ] }];
  expect(await api().listReactions([{ owner: 'u2', id: 'w1' }, { owner: 'me', id: 'w9' }])).toEqual([{ owner: 'u2', id: 'w1', userId: 'u3', emoji: '💪' }]);
  calls = [];
  await api().setReaction({ owner: 'u2', id: 'w1' }, '🔥', true);
  expect(calls).toContainEqual(['upsert', { workout_owner: 'u2', workout_id: 'w1', user_id: 'me', emoji: '🔥' }, { onConflict: 'workout_owner,workout_id,user_id,emoji', ignoreDuplicates: true }]);
  calls = [];
  await api().setReaction({ owner: 'u2', id: 'w1' }, '🔥', false);
  expect(calls).toContainEqual(['delete']);
  expect(calls).toContainEqual(['eq', 'user_id', 'me']);
  expect(calls).toContainEqual(['eq', 'emoji', '🔥']);
});

test('コメント：消していない分を古い順に。書く・消す（deleted にする）は自分の分', async () => {
  results = [{ data: [{ id: 'c1', workout_owner: 'u2', workout_id: 'w1', user_id: 'u3', body: 'ナイス', created_at: 't1' }] }];
  expect(await api().listComments([{ owner: 'u2', id: 'w1' }])).toEqual([{ owner: 'u2', id: 'w1', commentId: 'c1', userId: 'u3', body: 'ナイス', createdAt: 't1' }]);
  expect(calls).toContainEqual(['eq', 'deleted', false]);
  calls = [];
  await api().addComment({ owner: 'u2', id: 'w1' }, 'いいね');
  expect(calls).toContainEqual(['insert', { workout_owner: 'u2', workout_id: 'w1', user_id: 'me', body: 'いいね' }]);
  calls = [];
  await api().deleteComment('c1');
  expect(calls).toContainEqual(['update', { deleted: true }]);
  expect(calls).toContainEqual(['eq', 'id', 'c1']);
  expect(calls).toContainEqual(['eq', 'user_id', 'me']);
});

test('signInAnonymously はメールなしの人として返し、無効な設定ならエラー', async () => {
  expect(await api().signInAnonymously()).toEqual({ userId: 'anon1', email: '', anonymous: true });
  auth.signInAnonymously.mockResolvedValueOnce({ data: { user: null, session: null }, error: { name: 'AuthApiError', message: 'Anonymous sign-ins are disabled', status: 422 } });
  expect(await code(api().signInAnonymously())).toBe('unknown');
});

test('currentUser はメールなしの人に anonymous を付ける', async () => {
  session = { user: { id: 'anon1', is_anonymous: true } as { id: string } };
  expect(await api().currentUser()).toEqual({ userId: 'anon1', email: '', anonymous: true });
  session = { user: { id: 'me', email: 'me@example.com' } };
});

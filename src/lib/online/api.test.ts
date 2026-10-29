import { getApi, setApiForTest, type OnlineApi } from './api';
import { createFakeApi } from './fakeApi';

const cfg = vi.hoisted(() => ({ configured: false }));
const created = vi.hoisted(() => ({ count: 0 }));

vi.mock('./config', () => ({
  ONLINE: { url: 'https://x.supabase.co', anonKey: 'anon' },
  isOnlineConfigured: () => cfg.configured,
}));
vi.mock('./supabaseApi', () => ({
  createSupabaseApi: (c: { url: string; anonKey: string }) => {
    created.count++;
    return { kind: 'supabase', cfg: c } as unknown as OnlineApi;
  },
}));

afterEach(() => setApiForTest(null));

test('設定が無ければ窓口は無い', () => {
  cfg.configured = false;
  expect(getApi()).toBeNull();
  expect(created.count).toBe(0);
});

test('差し替えたものがあればそれを返す', () => {
  cfg.configured = true;
  const fake = createFakeApi();
  setApiForTest(fake);
  expect(getApi()).toBe(fake);
});

test('設定があれば Supabase 版を 1 回だけ作って使い回す', () => {
  cfg.configured = true;
  const a = getApi();
  const b = getApi();
  expect(a).toBe(b);
  expect(a).toMatchObject({ kind: 'supabase', cfg: { url: 'https://x.supabase.co', anonKey: 'anon' } });
  expect(created.count).toBe(1);
});

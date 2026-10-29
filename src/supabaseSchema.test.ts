import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// サーバーの表と「誰が見られるか」の決まりが消えたり抜けたりしないように、SQL の文字列を確かめる
const sql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');
const flat = sql.replace(/\s+/g, ' ');
const tables = [...flat.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map((m) => m[1]);

test('表がそろっている（第 1 段階と第 2 段階）', () => {
  for (const t of ['profiles', 'friendships', 'invites', 'shared_workouts', 'menu_messages', 'groups', 'group_members', 'reactions', 'comments', 'blocks', 'reports']) {
    expect(tables).toContain(t);
  }
});

test('すべての表で RLS が有効', () => {
  expect(tables.length).toBeGreaterThan(0);
  for (const t of tables) {
    expect(flat).toMatch(new RegExp(`alter table (public\\.)?${t} enable row level security`, 'i'));
  }
});

test('決まりで使う関数がある', () => {
  for (const f of ['is_connected', 'accept_invite', 'create_invite', 'delete_account']) {
    expect(flat).toContain(`create or replace function public.${f}`);
  }
});

test('shared_workouts は本人とつながっている人だけが読める', () => {
  const m = flat.match(/create policy \w+ on (?:public\.)?shared_workouts for select[^;]*;/i);
  expect(m).not.toBeNull();
  expect(m![0]).toContain('is_connected(auth.uid(), user_id)');
  expect(m![0]).toContain('user_id = auth.uid()');
});

test('shared_workouts の書き込みは本人だけ', () => {
  expect(flat).toMatch(/on (public\.)?shared_workouts for insert[^;]*with check \(user_id = auth\.uid\(\)\)/i);
  expect(flat).toMatch(/on (public\.)?shared_workouts for update[^;]*user_id = auth\.uid\(\)/i);
});

test('menu_messages は送った人と受け取った人だけが読める', () => {
  const m = flat.match(/create policy \w+ on (?:public\.)?menu_messages for select[^;]*;/i);
  expect(m).not.toBeNull();
  expect(m![0]).toContain('sender = auth.uid() or recipient = auth.uid()');
});

test('menu_messages は友達（ブロックなし）にだけ送れる', () => {
  const m = flat.match(/create policy \w+ on (?:public\.)?menu_messages for insert[^;]*;/i);
  expect(m).not.toBeNull();
  expect(m![0]).toContain('sender = auth.uid()');
  expect(m![0]).toContain('is_connected');
  expect(m![0]).toContain('friendships');
});

test('reports は誰も読めない', () => {
  expect(flat).not.toMatch(/on (public\.)?reports for (select|all)/i);
});

test('招待の失敗は invalid / expired / used / self の例外', () => {
  for (const e of ['invalid', 'expired', 'used', 'self']) {
    expect(flat).toContain(`raise exception '${e}'`);
  }
});

test('profiles.name は 1〜20 字、更新日時の index とトリガーがある', () => {
  expect(flat).toMatch(/char_length\(name\) between 1 and 20/);
  expect(flat).toMatch(/create index (if not exists )?\w+ on (public\.)?shared_workouts \(updated_at\)/i);
  expect(flat).toMatch(/create trigger \w+ before (insert or )?update on (public\.)?shared_workouts/i);
});

const fnBody = (name: string) => {
  const m = flat.match(new RegExp(`create or replace function public\\.${name}\\([^$]*\\$\\$(.*?)\\$\\$`, 'i'));
  expect(m).not.toBeNull();
  return m![1];
};

test('is_connected は本人がかかわる組み合わせしか調べられない', () => {
  expect(fnBody('is_connected')).toMatch(/coalesce\(auth\.uid\(\) in \(a, b\), false\)/);
});

test('is_group_member は本人のことしか調べられない', () => {
  expect(fnBody('is_group_member')).toMatch(/coalesce\(uid = auth\.uid\(\), false\)/);
});

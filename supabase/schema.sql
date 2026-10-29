-- キントレ部 オンライン共有のサーバー定義（Supabase / Postgres）
-- Supabase の管理画面（SQL Editor）に全部貼り付けて実行する。何度実行しても壊れないようにしてある。

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 表
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  owner uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.invites (
  code text primary key,
  kind text not null check (kind in ('friend', 'group')),
  owner uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references public.profiles (id) on delete set null,
  check ((kind = 'group') = (group_id is not null))
);

-- 端末の記録 id は端末ごとに決まるので、主キーは (user_id, id)
create table if not exists public.shared_workouts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  name text not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
-- 受け取りの差分（updated_at より新しいものだけ）を取るため
create index if not exists shared_workouts_updated_at_idx on public.shared_workouts (updated_at);

create table if not exists public.reactions (
  workout_owner uuid not null,
  workout_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏')),
  created_at timestamptz not null default now(),
  primary key (workout_owner, workout_id, user_id, emoji),
  foreign key (workout_owner, workout_id) references public.shared_workouts (user_id, id) on delete cascade
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workout_owner uuid not null,
  workout_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  foreign key (workout_owner, workout_id) references public.shared_workouts (user_id, id) on delete cascade
);
create index if not exists comments_workout_idx on public.comments (workout_owner, workout_id);
create index if not exists comments_updated_at_idx on public.comments (updated_at);

create table if not exists public.menu_messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('built', 'mine')),
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists menu_messages_recipient_idx on public.menu_messages (recipient, created_at);

create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  target_kind text not null check (target_kind in ('workout', 'comment', 'user')),
  target_id text not null,
  reason text not null default '' check (char_length(reason) between 0 and 200),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invites enable row level security;
alter table public.shared_workouts enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.menu_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- ============================================================
-- updated_at を update / insert のたびに now() にする
-- （deleted = true への更新も新しい updated_at になるので、受け取る側の差分に必ず載る）
-- ============================================================

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shared_workouts_touch on public.shared_workouts;
create trigger shared_workouts_touch before insert or update on public.shared_workouts
  for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before insert or update on public.comments
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 関数（security definer: RLS をまたいで調べる）
-- ============================================================

create or replace function public.is_group_member(gid uuid, uid uuid) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = uid);
$$;

-- つながっている = 友達、または同じグループのメンバー。どちらかがブロックしていれば false
create or replace function public.is_connected(a uuid, b uuid) returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    not exists (
      select 1 from public.blocks
      where (blocker = a and blocked = b) or (blocker = b and blocked = a)
    )
    and (
      exists (
        select 1 from public.friendships
        where user_a = least(a, b) and user_b = greatest(a, b)
      )
      or exists (
        select 1 from public.group_members m1
        join public.group_members m2 on m1.group_id = m2.group_id
        where m1.user_id = a and m2.user_id = b
      )
    );
$$;

-- 招待コード: 16 バイトの乱数を base64url（22 字）にしたもの
create or replace function public.create_invite(kind text, group_id uuid default null) returns text
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_code text;
begin
  if me is null then
    raise exception 'invalid';
  end if;
  if kind not in ('friend', 'group') then
    raise exception 'invalid';
  end if;
  if kind = 'friend' and group_id is not null then
    raise exception 'invalid';
  end if;
  if kind = 'group' and (group_id is null or not public.is_group_member(group_id, me)) then
    raise exception 'invalid';
  end if;
  new_code := translate(
    replace(encode(extensions.gen_random_bytes(16), 'base64'), '=', ''),
    '+/', '-_'
  );
  insert into public.invites (code, kind, owner, group_id, expires_at)
  values (new_code, kind, me, group_id, now() + interval '7 days');
  return new_code;
end;
$$;

create or replace function public.accept_invite(code text) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv public.invites%rowtype;
  owner_name text;
begin
  if me is null then
    raise exception 'invalid';
  end if;
  select * into inv from public.invites i where i.code = accept_invite.code for update;
  if not found then
    raise exception 'invalid';
  end if;
  if inv.used_by is not null and inv.kind = 'friend' then
    raise exception 'used';
  end if;
  if inv.expires_at < now() then
    raise exception 'expired';
  end if;
  if inv.owner = me then
    raise exception 'self';
  end if;
  -- 作った人との間にブロックがあれば、招待は無かったことにする
  if exists (
    select 1 from public.blocks
    where (blocker = me and blocked = inv.owner) or (blocker = inv.owner and blocked = me)
  ) then
    raise exception 'invalid';
  end if;

  if inv.kind = 'friend' then
    insert into public.friendships (user_a, user_b)
    values (least(me, inv.owner), greatest(me, inv.owner))
    on conflict do nothing;
    update public.invites set used_by = me where invites.code = inv.code;
  else
    insert into public.group_members (group_id, user_id)
    values (inv.group_id, me)
    on conflict do nothing;
  end if;

  select p.name into owner_name from public.profiles p where p.id = inv.owner;
  return json_build_object('kind', inv.kind, 'user_id', inv.owner, 'name', owner_name);
end;
$$;

-- 本人のデータを消し、ログインのユーザーも消す。owner だったグループは一番古いメンバーに引き継ぎ、いなければ消す
create or replace function public.delete_account() returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g record;
  heir uuid;
begin
  if me is null then
    raise exception 'invalid';
  end if;
  for g in select id from public.groups where owner = me loop
    select user_id into heir from public.group_members
      where group_id = g.id and user_id <> me
      order by joined_at, user_id limit 1;
    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner = heir where id = g.id;
    end if;
  end loop;
  delete from public.reactions where user_id = me;
  delete from public.comments where user_id = me;
  delete from public.shared_workouts where user_id = me;
  delete from public.friendships where user_a = me or user_b = me;
  delete from public.group_members where user_id = me;
  delete from public.invites where owner = me;
  delete from public.blocks where blocker = me or blocked = me;
  delete from public.menu_messages where sender = me or recipient = me;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.is_group_member(uuid, uuid) from public, anon;
revoke all on function public.is_connected(uuid, uuid) from public, anon;
revoke all on function public.create_invite(text, uuid) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_connected(uuid, uuid) to authenticated;
grant execute on function public.create_invite(text, uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
-- 誰が見られるか（RLS）
-- ============================================================

-- profiles: 本人とつながっている人が読める。書けるのは本人だけ
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_connected(auth.uid(), id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- friendships: 自分の分だけ読める。作るのは accept_invite だけ。やめるのは本人
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- groups: メンバーだけが読める。作るのは本人（owner = 自分）。名前を変えられるのは owner だけ
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (owner = auth.uid() or public.is_group_member(id, auth.uid()));
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated
  with check (owner = auth.uid());
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated
  using (owner = auth.uid());

-- group_members: メンバーだけが読める。自分を入れられるのは自分のグループだけ（ほかは accept_invite）。抜けるのは本人
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id, auth.uid()));
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_id and g.owner = auth.uid())
  );
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid());

-- invites: 作るのは create_invite、使うのは accept_invite だけ。作った本人だけが読める
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated
  using (owner = auth.uid());
drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated
  using (owner = auth.uid());

-- shared_workouts: 本人はすべて読み書き、つながっている人は読むだけ
drop policy if exists shared_workouts_select on public.shared_workouts;
create policy shared_workouts_select on public.shared_workouts for select to authenticated
  using (user_id = auth.uid() or public.is_connected(auth.uid(), user_id));
drop policy if exists shared_workouts_insert on public.shared_workouts;
create policy shared_workouts_insert on public.shared_workouts for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists shared_workouts_update on public.shared_workouts;
create policy shared_workouts_update on public.shared_workouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists shared_workouts_delete on public.shared_workouts;
create policy shared_workouts_delete on public.shared_workouts for delete to authenticated
  using (user_id = auth.uid());

-- reactions: その記録を読める人が読めて、自分の分を足せる。消せるのは自分の分だけ
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated
  using (workout_owner = auth.uid() or public.is_connected(auth.uid(), workout_owner));
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (workout_owner = auth.uid() or public.is_connected(auth.uid(), workout_owner))
  );
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- comments: 同じく。消すときは deleted = true にする（自分の分の update だけ）
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (workout_owner = auth.uid() or public.is_connected(auth.uid(), workout_owner));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and (workout_owner = auth.uid() or public.is_connected(auth.uid(), workout_owner))
  );
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- menu_messages: 送れるのは友達（ブロックなし）にだけ。読めるのは送った人と受け取った人だけ
drop policy if exists menu_messages_select on public.menu_messages;
create policy menu_messages_select on public.menu_messages for select to authenticated
  using (sender = auth.uid() or recipient = auth.uid());
drop policy if exists menu_messages_insert on public.menu_messages;
create policy menu_messages_insert on public.menu_messages for insert to authenticated
  with check (
    sender = auth.uid()
    and exists (
      select 1 from public.friendships f
      where f.user_a = least(sender, recipient) and f.user_b = greatest(sender, recipient)
    )
    and public.is_connected(sender, recipient)
  );
drop policy if exists menu_messages_delete on public.menu_messages;
create policy menu_messages_delete on public.menu_messages for delete to authenticated
  using (recipient = auth.uid() or sender = auth.uid());

-- blocks: 本人の分だけ
drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks for select to authenticated
  using (blocker = auth.uid());
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker = auth.uid());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker = auth.uid());

-- reports: 書くだけ。読む policy は作らない（管理画面で開発者だけが見る）
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter = auth.uid());

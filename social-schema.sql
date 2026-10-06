grant select on table public.portfolio_data to anon;

drop policy if exists "Published portfolios are publicly viewable" on public.portfolio_data;
create policy "Published portfolios are publicly viewable"
  on public.portfolio_data
  for select
  to anon, authenticated
  using (true);

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  picture_url text,
  bio text not null default '',
  interests jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;
grant select on table public.public_profiles to anon, authenticated;
grant insert, update, delete on table public.public_profiles to authenticated;

drop policy if exists "Public profiles are discoverable" on public.public_profiles;
create policy "Public profiles are discoverable"
  on public.public_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users create their own public profile" on public.public_profiles;
create policy "Users create their own public profile"
  on public.public_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own public profile" on public.public_profiles;
create policy "Users update their own public profile"
  on public.public_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own public profile" on public.public_profiles;
create policy "Users delete their own public profile"
  on public.public_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.account_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists account_follows_following_id_idx
  on public.account_follows (following_id);
create index if not exists account_follows_follower_id_idx
  on public.account_follows (follower_id);

alter table public.account_follows enable row level security;
grant select, insert, delete on table public.account_follows to authenticated;
revoke all on table public.account_follows from anon;

drop policy if exists "Users read their own follows" on public.account_follows;
drop policy if exists "Users read relationships that involve them" on public.account_follows;
create policy "Users read relationships that involve them"
  on public.account_follows
  for select
  to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

drop policy if exists "Users follow as themselves" on public.account_follows;
create policy "Users follow as themselves"
  on public.account_follows
  for insert
  to authenticated
  with check ((select auth.uid()) = follower_id and follower_id <> following_id);

drop policy if exists "Users unfollow as themselves" on public.account_follows;
create policy "Users unfollow as themselves"
  on public.account_follows
  for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null check (notification_type = 'new_follower'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);

create index if not exists account_notifications_recipient_created_idx
  on public.account_notifications (recipient_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'account_notifications'
    ) then
    execute 'alter publication supabase_realtime add table public.account_notifications';
  end if;
end;
$$;

alter table public.account_notifications enable row level security;
grant select on table public.account_notifications to authenticated;
grant update (read_at) on table public.account_notifications to authenticated;
revoke all on table public.account_notifications from anon;

drop policy if exists "Users read their own notifications" on public.account_notifications;
create policy "Users read their own notifications"
  on public.account_notifications
  for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Users mark their own notifications read" on public.account_notifications;
create policy "Users mark their own notifications read"
  on public.account_notifications
  for update
  to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.account_notifications (recipient_id, actor_id, notification_type)
  values (new.following_id, new.follower_id, 'new_follower');
  return new;
end;
$$;

revoke all on function public.notify_new_follower() from public, anon, authenticated;

drop trigger if exists account_follows_notify_recipient on public.account_follows;
create trigger account_follows_notify_recipient
  after insert on public.account_follows
  for each row execute function public.notify_new_follower();
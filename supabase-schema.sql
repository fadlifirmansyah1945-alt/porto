create table if not exists public.portfolio_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"albums": [], "works": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_data enable row level security;
grant select, insert, update, delete on table public.portfolio_data to authenticated;
revoke all on table public.portfolio_data from anon;

drop policy if exists "Users manage their own portfolio" on public.portfolio_data;
create policy "Users manage their own portfolio"
  on public.portfolio_data
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
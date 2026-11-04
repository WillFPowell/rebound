begin;
create table if not exists public.peer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  recovery_stage text not null check (recovery_stage in ('First weeks away', 'Working through recovery', 'Returning to practice')),
  support_preference text not null check (support_preference in ('Someone to listen', 'Shared experience', 'Encouragement')),
  discoverable boolean not null default false
);
alter table public.peer_profiles enable row level security;
revoke all on public.peer_profiles from public, anon, authenticated;
grant select, insert, update on public.peer_profiles to authenticated;
drop policy if exists "Read own profile" on public.peer_profiles;
create policy "Read own profile" on public.peer_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own profile" on public.peer_profiles;
create policy "Insert own profile" on public.peer_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own profile" on public.peer_profiles;
create policy "Update own profile" on public.peer_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;

-- YugiFAUX private Discord-to-profile linking migration.
-- Run once in the Supabase SQL Editor after banlist-review.sql.

create table if not exists public.league_profiles (
  discord_id text primary key,
  profile_name text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.league_profiles enable row level security;

drop policy if exists "participants read their linked league profile or admins read all" on public.league_profiles;
create policy "participants read their linked league profile or admins read all" on public.league_profiles for select
using (exists (
  select 1 from public.review_participants p
  where p.user_id = auth.uid()
    and (p.discord_id = league_profiles.discord_id or public.is_review_admin())
));

grant select on public.league_profiles to authenticated;
grant all on public.league_profiles to service_role;

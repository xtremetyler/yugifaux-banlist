-- YugiFAUX Banlist Review
-- Run this once in the Supabase SQL editor after enabling Discord Auth.

create extension if not exists pgcrypto;

create table if not exists public.review_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text not null unique,
  display_name text not null,
  approved boolean not null default false,
  active boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_settings (
  id smallint primary key default 1 check (id = 1),
  title text not null default 'YugiFAUX Banlist Review',
  nomination_open boolean not null default false,
  ballot_open boolean not null default false,
  nomination_threshold integer not null default 2 check (nomination_threshold between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.review_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.card_nominations (
  id uuid primary key default gen_random_uuid(),
  card_id bigint not null,
  user_id uuid not null references public.review_participants(user_id) on delete cascade,
  concern text not null check (concern in ('too-powerful','too-weak','unhealthy','needs-discussion')),
  suggested_status text not null check (suggested_status in ('banned','limeade','semi-limeade','unlimeade')),
  explanation text not null default '' check (char_length(explanation) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create table if not exists public.review_cards (
  card_id bigint primary key,
  included boolean not null default true,
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  added_by uuid references public.review_participants(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_ballots (
  id uuid primary key default gen_random_uuid(),
  card_id bigint not null references public.review_cards(card_id) on delete cascade,
  user_id uuid not null references public.review_participants(user_id) on delete cascade,
  recommended_status text not null check (recommended_status in ('banned','limeade','semi-limeade','unlimeade','abstain')),
  comment text not null default '' check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create or replace function public.is_review_participant(check_active boolean default true)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.review_participants p
  where p.user_id = auth.uid() and p.approved and (not check_active or p.active)
) $$;

create or replace function public.is_review_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.review_participants p
  where p.user_id = auth.uid() and p.approved and p.active and p.is_admin
) $$;

create or replace function public.handle_review_signup()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.review_participants(user_id, discord_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub', new.id::text),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'preferred_username', 'Discord participant')
  ) on conflict (user_id) do update set
    discord_id = excluded.discord_id,
    display_name = excluded.display_name,
    updated_at = now();
  return new;
end $$;

drop trigger if exists on_auth_user_created_review on auth.users;
create trigger on_auth_user_created_review after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.handle_review_signup();

alter table public.review_participants enable row level security;
alter table public.review_settings enable row level security;
alter table public.card_nominations enable row level security;
alter table public.review_cards enable row level security;
alter table public.card_ballots enable row level security;

create policy "participants read themselves or admins" on public.review_participants for select
using (user_id = auth.uid() or public.is_review_admin());
create policy "admins manage participant access" on public.review_participants for update
using (public.is_review_admin()) with check (public.is_review_admin());
create policy "approved participants read settings" on public.review_settings for select
using (public.is_review_participant(false));
create policy "admins update settings" on public.review_settings for update
using (public.is_review_admin()) with check (public.is_review_admin());

create policy "participants read own nominations; admins read all" on public.card_nominations for select
using (user_id = auth.uid() or public.is_review_admin());
create policy "active participants nominate while open" on public.card_nominations for insert
with check (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and nomination_open
));
create policy "participants edit own nominations while open" on public.card_nominations for update
using (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and nomination_open
)) with check (user_id = auth.uid());
create policy "participants withdraw own nominations while open" on public.card_nominations for delete
using (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and nomination_open
));

create policy "participants read official review cards" on public.review_cards for select
using (public.is_review_participant(false));
create policy "admins add official review cards" on public.review_cards for insert
with check (public.is_review_admin());
create policy "admins update official review cards" on public.review_cards for update
using (public.is_review_admin()) with check (public.is_review_admin());
create policy "admins remove official review cards" on public.review_cards for delete
using (public.is_review_admin());

create policy "participants read own ballots; admins read all" on public.card_ballots for select
using (user_id = auth.uid() or public.is_review_admin());
create policy "active participants vote while open" on public.card_ballots for insert
with check (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and ballot_open
) and exists (
  select 1 from public.review_cards r where r.card_id=card_ballots.card_id and r.included
));
create policy "participants edit own ballots while open" on public.card_ballots for update
using (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and ballot_open
)) with check (user_id = auth.uid());
create policy "participants withdraw own ballots while open" on public.card_ballots for delete
using (user_id = auth.uid() and public.is_review_participant() and exists (
  select 1 from public.review_settings where id=1 and ballot_open
));

grant execute on function public.is_review_participant(boolean) to authenticated;
grant execute on function public.is_review_admin() to authenticated;

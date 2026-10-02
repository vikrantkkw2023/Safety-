-- Safety MVP 1 database
-- Run only after creating a Supabase project.
-- RLS is enabled so users can only access their own records.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  country_code text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  country_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'CANCELLED', 'RESOLVED'))
);

create unique index if not exists profiles_phone_unique_idx
  on public.profiles(phone)
  where phone is not null;

create index if not exists emergency_contacts_user_id_idx
  on public.emergency_contacts(user_id);

create index if not exists emergency_incidents_user_id_idx
  on public.emergency_incidents(user_id);

create index if not exists emergency_incidents_status_idx
  on public.emergency_incidents(status);

alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.emergency_incidents enable row level security;

create policy "profiles own row"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "contacts own rows"
  on public.emergency_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "incidents own rows"
  on public.emergency_incidents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- IMPORTANT:
-- Notification delivery to trusted contacts must not expose the Supabase
-- service-role key in the mobile app. Use a trusted server/Edge Function
-- for production notifications.

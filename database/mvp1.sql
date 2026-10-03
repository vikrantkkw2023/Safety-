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
  client_local_id text,
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

-- Repair databases created from the earlier draft where client_local_id was attached to contacts.
alter table public.emergency_contacts drop column if exists client_local_id;
alter table public.emergency_incidents add column if not exists client_local_id text;

create unique index if not exists emergency_incidents_client_local_id_idx
  on public.emergency_incidents(user_id, client_local_id)
  where client_local_id is not null;

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


-- Prevent more than one ACTIVE incident per user at the database layer.
create unique index if not exists emergency_incidents_one_active_per_user_idx
  on public.emergency_incidents(user_id)
  where status = 'ACTIVE';

-- Basic coordinate safety checks.
alter table public.emergency_incidents
  drop constraint if exists emergency_incidents_latitude_range;
alter table public.emergency_incidents
  add constraint emergency_incidents_latitude_range
  check (latitude between -90 and 90);

alter table public.emergency_incidents
  drop constraint if exists emergency_incidents_longitude_range;
alter table public.emergency_incidents
  add constraint emergency_incidents_longitude_range
  check (longitude between -180 and 180);

alter table public.emergency_incidents
  drop constraint if exists emergency_incidents_accuracy_nonnegative;
alter table public.emergency_incidents
  add constraint emergency_incidents_accuracy_nonnegative
  check (accuracy is null or accuracy >= 0);


-- Trusted-contact push notification foundation.
-- Device tokens belong to authenticated users. The server/Edge Function is
-- responsible for delivering notifications; no privileged key belongs in the app.
create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_devices_user_token_idx
  on public.notification_devices(user_id, expo_push_token);

alter table public.notification_devices enable row level security;

create policy "notification devices own rows"
  on public.notification_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notification device hardening
alter table public.notification_devices
  drop constraint if exists notification_devices_token_length;
alter table public.notification_devices
  add constraint notification_devices_token_length
  check (char_length(expo_push_token) between 10 and 512);


create table if not exists public.incident_audio_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.emergency_incidents(id) on delete cascade,
  storage_path text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('LOCAL_PENDING_UPLOAD','UPLOADED','FAILED')),
  created_at timestamptz not null default now()
);

create index if not exists incident_audio_evidence_incident_idx
  on public.incident_audio_evidence(incident_id);

alter table public.incident_audio_evidence enable row level security;

create policy "audio evidence owner access"
  on public.incident_audio_evidence for all
  using (
    exists (
      select 1 from public.emergency_incidents i
      where i.id = incident_audio_evidence.incident_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.emergency_incidents i
      where i.id = incident_audio_evidence.incident_id
        and i.user_id = auth.uid()
    )
  );

create table if not exists public.incident_audio_uploads (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.incident_audio_evidence(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('STARTED','SUCCEEDED','FAILED')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists incident_audio_uploads_evidence_idx
  on public.incident_audio_uploads(evidence_id);

alter table public.incident_audio_uploads enable row level security;

create policy "audio upload owner read"
  on public.incident_audio_uploads for select
  using (
    exists (
      select 1
      from public.incident_audio_evidence e
      join public.emergency_incidents i on i.id = e.incident_id
      where e.id = incident_audio_uploads.evidence_id
        and i.user_id = auth.uid()
    )
  );

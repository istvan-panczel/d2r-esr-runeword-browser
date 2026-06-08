-- 001_initial_schema.sql
--
-- Build Sharing feature — initial schema.
-- Assembled from builds-feature-docs/FEATURE-BUILD-SHARING.md.
--
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD.
-- See builds-feature-docs/SUPABASE-SETUP.md (Step 5).
--
-- Contents:
--   1. Extensions
--   2. Tables        : profiles, builds, likes
--   3. Indexes       : cursor-pagination + lookups
--   4. Functions     : handle_new_user, handle_likes_change
--   5. Triggers      : new-user, likes-count, updated_at (moddatetime)
--   6. Row Level Security policies

-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================

-- moddatetime: auto-maintains updated_at columns on UPDATE.
create extension if not exists moddatetime schema extensions;

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- profiles -----------------------------------------------------------
-- One row per auth user, auto-created by handle_new_user() on signup.
-- Email is NEVER stored here; only the public display_name#discriminator.
create table public.profiles (
  id                         uuid primary key references auth.users (id) on delete cascade,
  display_name               text     not null,
  discriminator              smallint not null default floor(random() * 9000 + 1000)::smallint,
  avatar_url                 text,
  privacy_policy_accepted_at timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- Allows duplicate display names as long as the discriminator differs (old Discord style).
  constraint profiles_name_discriminator_key unique (display_name, discriminator),
  -- Validation limit from the feature doc (display name 1-50 chars).
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 50),
  constraint profiles_discriminator_range check (discriminator between 1000 and 9999)
);

comment on table  public.profiles is 'Public user profiles. Email is never stored here.';
comment on column public.profiles.discriminator is 'Random 1000-9999, paired with display_name for uniqueness.';
comment on column public.profiles.privacy_policy_accepted_at is 'NULL until the consent gate is accepted; required to use build features.';

-- builds -------------------------------------------------------------
-- All builds are public. No draft/private state.
create table public.builds (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  name                text not null,
  description         text,
  class               text not null,
  build_data          jsonb not null default '{}'::jsonb,
  esr_version         text,          -- ESR version at creation; never changes.
  esr_version_updated text,          -- ESR version at last edit; NULL if never edited.
  likes_count         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Validation limits from the feature doc (name 1-100, description <=2000).
  constraint builds_name_len check (char_length(name) between 1 and 100),
  constraint builds_description_len check (description is null or char_length(description) <= 2000)
);

comment on table  public.builds is 'Community builds. Always public.';
comment on column public.builds.build_data is 'Typed item references with stat snapshots; see FEATURE-BUILD-SHARING.md.';
comment on column public.builds.likes_count is 'Denormalized count maintained by the on_like_changed trigger.';

-- likes --------------------------------------------------------------
-- Composite PK enforces one like per user per build.
create table public.likes (
  build_id uuid not null references public.builds (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (build_id, user_id)
);

comment on table public.likes is 'One row per (build, user) like. PK prevents double-liking.';

-- =====================================================================
-- 3. INDEXES
-- =====================================================================

-- Cursor pagination — "Newest first": order by (created_at desc, id desc).
create index builds_created_at_id_idx on public.builds (created_at desc, id desc);

-- Cursor pagination — "Most liked": order by (likes_count desc, created_at desc, id desc).
create index builds_likes_created_id_idx on public.builds (likes_count desc, created_at desc, id desc);

-- "My Builds" filter and the profiles join.
create index builds_user_id_idx on public.builds (user_id);

-- Reverse lookup of a user's likes (the PK already covers build_id-first lookups).
create index likes_user_id_idx on public.likes (user_id);

-- =====================================================================
-- 4. FUNCTIONS
-- =====================================================================

-- Auto-create a profile row whenever an auth user is created.
-- Discord: prefill display_name from full_name/user_name and avatar_url from metadata.
-- Magic link: no metadata -> default to 'Adventurer', no avatar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      'Adventurer'
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Maintain builds.likes_count on like insert/delete so reads never COUNT().
create or replace function public.handle_likes_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.builds set likes_count = likes_count + 1 where id = new.build_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.builds set likes_count = likes_count - 1 where id = old.build_id;
    return old;
  end if;
  return null;
end;
$$;

-- =====================================================================
-- 5. TRIGGERS
-- =====================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_like_changed
  after insert or delete on public.likes
  for each row execute function public.handle_likes_change();

-- updated_at auto-maintenance (moddatetime takes the target column as its arg).
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function extensions.moddatetime(updated_at);

create trigger builds_set_updated_at
  before update on public.builds
  for each row execute function extensions.moddatetime(updated_at);

-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.builds   enable row level security;
alter table public.likes    enable row level security;

-- profiles -----------------------------------------------------------
-- Public display names: anyone may read.
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users may update only their own profile.
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- builds -------------------------------------------------------------
-- All builds are public.
create policy "Builds are viewable by everyone"
  on public.builds for select
  using (true);

-- Authenticated users may create builds owned by themselves.
create policy "Users can insert own builds"
  on public.builds for insert
  with check (auth.uid() = user_id);

-- Owners may update their builds.
create policy "Users can update own builds"
  on public.builds for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owners may delete their builds.
create policy "Users can delete own builds"
  on public.builds for delete
  using (auth.uid() = user_id);

-- likes --------------------------------------------------------------
-- Anyone may read likes (counts + liked state).
create policy "Likes are viewable by everyone"
  on public.likes for select
  using (true);

-- Authenticated users may like as themselves.
create policy "Users can insert own likes"
  on public.likes for insert
  with check (auth.uid() = user_id);

-- Users may remove only their own likes.
create policy "Users can delete own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- 005_loot_filters.sql
--
-- Loot filter sharing: saved loot filters (public or private), their likes and
-- a download counter. Spec: builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md.
--
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD — same flow
-- as 001-004. Safe on a populated database: only new objects, no changes to the
-- existing tables.
--
-- Contents:
--   1. Tables     : loot_filters, loot_filter_likes
--   2. Indexes    : cursor pagination + lookups
--   3. Functions  : before-update bookkeeping, per-user cap, likes count, download counter
--   4. Triggers
--   5. Row Level Security policies
--   6. Grants     : column-scoped writes (003 style), the download RPC

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- loot_filters -------------------------------------------------------
-- One row per saved filter. Public unless is_private; a private filter is
-- visible to its owner only. `content` is the filter file exactly as saved
-- (JSON, possibly with // comments, so it is text, not jsonb). The metadata
-- columns are read from the file by the client at save time for the lists.
create table public.loot_filters (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  name                   text not null,
  description            text,
  content                text not null,
  is_private             boolean not null default false,

  -- Read from the file at save time.
  title                  text,
  author                 text,
  file_version           text,
  rule_count             integer not null default 0,
  levels                 jsonb,

  -- ESR and loot filter plugin versions at creation (never change) and at the
  -- last content save (NULL if never re-saved).
  esr_version            text,
  plugin_version         text,
  esr_version_updated    text,
  plugin_version_updated text,

  -- The latest "what changed" note of a content save.
  change_note            text,

  -- Where the filter came from: a shared filter (id + the revision taken) or a
  -- bundled template (key + version). The label keeps "X by Y#1234" readable
  -- when the source is deleted or made private.
  based_on_id            uuid references public.loot_filters (id) on delete set null,
  based_on_revision      integer,
  based_on_template      text,
  based_on_version       text,
  based_on_label         text,

  -- Bumped by loot_filters_before_update when content changes; copies compare it.
  revision               integer not null default 1,
  likes_count            integer not null default 0,
  download_count         integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint loot_filters_name_len check (char_length(name) between 1 and 100),
  constraint loot_filters_description_len check (description is null or char_length(description) <= 2000),
  constraint loot_filters_content_size check (octet_length(content) between 1 and 524288),
  constraint loot_filters_title_len check (title is null or char_length(title) <= 200),
  constraint loot_filters_author_len check (author is null or char_length(author) <= 200),
  constraint loot_filters_file_version_len check (file_version is null or char_length(file_version) <= 200),
  constraint loot_filters_rule_count_range check (rule_count between 0 and 100000),
  constraint loot_filters_levels_shape check (
    levels is null or (jsonb_typeof(levels) = 'array' and octet_length(levels::text) <= 4096)
  ),
  constraint loot_filters_versions_len check (
    char_length(coalesce(esr_version, '')) <= 50
    and char_length(coalesce(plugin_version, '')) <= 50
    and char_length(coalesce(esr_version_updated, '')) <= 50
    and char_length(coalesce(plugin_version_updated, '')) <= 50
  ),
  constraint loot_filters_change_note_len check (change_note is null or char_length(change_note) <= 200),
  constraint loot_filters_based_on_len check (
    char_length(coalesce(based_on_template, '')) <= 50
    and char_length(coalesce(based_on_version, '')) <= 50
    and char_length(coalesce(based_on_label, '')) <= 200
  )
);

comment on table  public.loot_filters is 'Saved loot filters. Public unless is_private (owner-only).';
comment on column public.loot_filters.content is 'The filter file as saved (JSON with optional comments), up to 512 KB.';
comment on column public.loot_filters.revision is 'Bumped by loot_filters_before_update when content changes. Not client-writable.';
comment on column public.loot_filters.likes_count is 'Denormalized count maintained by the on_loot_filter_like_changed trigger.';
comment on column public.loot_filters.download_count is 'Maintained by increment_loot_filter_download(); a rough number.';

-- loot_filter_likes --------------------------------------------------
-- Composite PK enforces one like per user per filter.
create table public.loot_filter_likes (
  filter_id uuid not null references public.loot_filters (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (filter_id, user_id)
);

comment on table public.loot_filter_likes is 'One row per (loot filter, user) like.';

-- =====================================================================
-- 2. INDEXES
-- =====================================================================

-- Cursor pagination — "Newest first": (created_at desc, id desc).
create index loot_filters_created_at_id_idx on public.loot_filters (created_at desc, id desc);

-- Cursor pagination — "Most liked": (likes_count desc, created_at desc, id desc).
create index loot_filters_likes_created_id_idx on public.loot_filters (likes_count desc, created_at desc, id desc);

-- "My filters" and the profile page.
create index loot_filters_user_id_idx on public.loot_filters (user_id);

-- The on delete set null of based_on_id looks copies up by their source.
create index loot_filters_based_on_id_idx on public.loot_filters (based_on_id);

-- Reverse lookup of a user's likes (the PK covers filter_id-first lookups).
create index loot_filter_likes_user_id_idx on public.loot_filter_likes (user_id);

-- =====================================================================
-- 3. FUNCTIONS
-- =====================================================================

-- Bookkeeping on update. Not SECURITY DEFINER: column grants only cover the
-- columns a client's UPDATE names, not what a trigger writes into NEW, so this
-- may set revision and updated_at although clients cannot.
--   * revision moves only when the content changes (copies compare it).
--   * updated_at moves when the filter itself changes, not on likes_count /
--     download_count bumps or the based_on_id "on delete set null".
create or replace function public.loot_filters_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.revision := old.revision + 1;
  end if;

  if new.content is distinct from old.content
     or new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.is_private is distinct from old.is_private
     or new.change_note is distinct from old.change_note
     or new.based_on_revision is distinct from old.based_on_revision
     or new.based_on_version is distinct from old.based_on_version
     or new.based_on_label is distinct from old.based_on_label then
    new.updated_at := now();
  else
    -- Keep a client from moving updated_at on its own (it has no grant anyway).
    new.updated_at := old.updated_at;
  end if;

  -- Immutable after insert, whatever the caller sends (defence in depth on top
  -- of the column grants; the definer counters below write their own columns).
  new.created_at := old.created_at;
  return new;
end;
$$;

-- At most 50 filters per user (private ones included). SECURITY DEFINER so the
-- count sees every row of the user regardless of RLS. Two concurrent inserts at
-- 49 may both pass; acceptable at this scale.
create or replace function public.loot_filters_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.loot_filters where user_id = new.user_id) >= 50 then
    raise exception 'loot_filter_limit: a user may have at most 50 loot filters'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Maintain loot_filters.likes_count on like insert/delete (copy of 001's
-- handle_likes_change). The counter-only update leaves updated_at alone (see
-- loot_filters_before_update).
create or replace function public.handle_loot_filter_likes_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.loot_filters set likes_count = likes_count + 1 where id = new.filter_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.loot_filters set likes_count = greatest(likes_count - 1, 0) where id = old.filter_id;
    return old;
  end if;
  return null;
end;
$$;

-- +1 download for a filter the caller may see (public, or their own). Callable
-- by anyone, signed in or not, so the number is rough by design.
create or replace function public.increment_loot_filter_download(filter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.loot_filters f
     set download_count = f.download_count + 1
   where f.id = increment_loot_filter_download.filter_id
     and (not f.is_private or f.user_id = auth.uid());
end;
$$;

-- =====================================================================
-- 4. TRIGGERS
-- =====================================================================

create trigger loot_filters_before_update
  before update on public.loot_filters
  for each row execute function public.loot_filters_before_update();

create trigger loot_filters_cap
  before insert on public.loot_filters
  for each row execute function public.loot_filters_cap();

create trigger on_loot_filter_like_changed
  after insert or delete on public.loot_filter_likes
  for each row execute function public.handle_loot_filter_likes_change();

-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================

alter table public.loot_filters      enable row level security;
alter table public.loot_filter_likes enable row level security;

-- loot_filters -------------------------------------------------------
-- Public filters for everyone; private ones for their owner only.
create policy "Public loot filters are viewable by everyone"
  on public.loot_filters for select
  using (not is_private or auth.uid() = user_id);

create policy "Users can insert own loot filters"
  on public.loot_filters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own loot filters"
  on public.loot_filters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own loot filters"
  on public.loot_filters for delete
  using (auth.uid() = user_id);

-- loot_filter_likes --------------------------------------------------
-- A like is visible when its filter is (RLS on the subquery hides private
-- filters), so likes never reveal a private filter's id. Likes stay when a
-- filter goes private and count again when it is public again.
create policy "Loot filter likes are viewable with their filter"
  on public.loot_filter_likes for select
  using (exists (select 1 from public.loot_filters f where f.id = filter_id));

-- Like as yourself, and only a public filter.
create policy "Users can like public loot filters"
  on public.loot_filter_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.loot_filters f where f.id = filter_id and not f.is_private)
  );

create policy "Users can delete own loot filter likes"
  on public.loot_filter_likes for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- 6. GRANTS
-- =====================================================================

-- Column-scoped writes (003 style): drop the table-wide INSERT/UPDATE the
-- Supabase defaults grant to the API roles, then grant only the user columns
-- to `authenticated`. id, revision, likes_count, download_count, created_at
-- and updated_at fall back to defaults / triggers and cannot be spoofed.
revoke insert, update on public.loot_filters from anon, authenticated;

grant insert (
  user_id, name, description, content, is_private,
  title, author, file_version, rule_count, levels,
  esr_version, plugin_version, esr_version_updated, plugin_version_updated,
  change_note,
  based_on_id, based_on_revision, based_on_template, based_on_version, based_on_label
) on public.loot_filters to authenticated;

-- Not updatable: user_id (ownership), esr_version / plugin_version ("created
-- with"), based_on_id / based_on_template (where it came from), the counters,
-- revision and the timestamps.
grant update (
  name, description, content, is_private,
  title, author, file_version, rule_count, levels,
  esr_version_updated, plugin_version_updated,
  change_note,
  based_on_revision, based_on_version, based_on_label
) on public.loot_filters to authenticated;

-- Likes: rows are immutable (insert / delete only); anon cannot write.
revoke insert, update on public.loot_filter_likes from anon, authenticated;
grant insert (filter_id, user_id) on public.loot_filter_likes to authenticated;

-- The download counter RPC, for signed-in users and visitors. Functions are
-- executable by PUBLIC by default; make the intended callers explicit. (The
-- trigger functions return `trigger` and cannot be called through the API.)
revoke execute on function public.increment_loot_filter_download(uuid) from public;
grant execute on function public.increment_loot_filter_download(uuid) to anon, authenticated;

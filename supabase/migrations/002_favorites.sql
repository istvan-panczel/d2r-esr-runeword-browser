-- 002_favorites.sql
--
-- Item favourites feature — runeword / gemword / unique-item favourites.
--
-- Moves favourites from per-device localStorage into Supabase so they sync
-- across devices, and adds a public per-item favourite count.
--
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD
-- (same flow as 001_initial_schema.sql).
--
-- Design notes:
--   * The items themselves are NOT in Postgres — runewords/gemwords/uniques are
--     parsed into the browser's IndexedDB. A favourite is therefore keyed by the
--     stable string id the client already builds, e.g. 'runeword:Spirit:1',
--     'gemword:Black:1', 'htmUnique:Nagelring:rin'. These ids exclude volatile
--     data, so they survive upstream data refreshes.
--   * favorite_counts is a denormalized aggregate (one row per favourited item),
--     maintained by a trigger so reads never COUNT() — same pattern as
--     builds.likes_count. There is no item row to hang the count on, hence its
--     own table.
--
-- Contents:
--   1. Tables    : favorites, favorite_counts
--   2. Functions : handle_favorites_change
--   3. Triggers  : favorites-count
--   4. Row Level Security policies

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- favorites ----------------------------------------------------------
-- One row per (user, favourited item). Rows are immutable: insert to add,
-- delete to remove (no updated_at needed).
create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    text not null,
  created_at timestamptz not null default now(),

  -- One favourite per user per item.
  primary key (user_id, item_id),
  -- Defensive bound on the client-built id (longest is well under this).
  constraint favorites_item_id_len check (char_length(item_id) between 1 and 200)
);

comment on table  public.favorites is 'One row per (user, favourited item). item_id is a stable client-built string, not a FK.';
comment on column public.favorites.item_id is 'Stable item id, e.g. runeword:Spirit:1 / gemword:Black:1 / htmUnique:Nagelring:rin.';

-- favorite_counts ----------------------------------------------------
-- Denormalized favourite count per item. Only items with >= 1 favourite have
-- a row, so the table stays sparse and can be read in full cheaply.
create table public.favorite_counts (
  item_id text primary key,
  count   integer not null default 0
);

comment on table  public.favorite_counts is 'Denormalized per-item favourite count, maintained by the on_favorite_changed trigger.';

-- =====================================================================
-- 2. FUNCTIONS
-- =====================================================================

-- Maintain favorite_counts on favourite insert/delete so reads never COUNT().
create or replace function public.handle_favorites_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.favorite_counts (item_id, count)
    values (new.item_id, 1)
    on conflict (item_id) do update set count = favorite_counts.count + 1;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.favorite_counts set count = count - 1 where item_id = old.item_id;
    -- Drop the row once nobody favourites the item, keeping the table sparse.
    delete from public.favorite_counts where item_id = old.item_id and count <= 0;
    return old;
  end if;
  return null;
end;
$$;

-- =====================================================================
-- 3. TRIGGERS
-- =====================================================================

create trigger on_favorite_changed
  after insert or delete on public.favorites
  for each row execute function public.handle_favorites_change();

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

alter table public.favorites       enable row level security;
alter table public.favorite_counts enable row level security;

-- favorites ----------------------------------------------------------
-- Favourites are public (anyone may see who favourited what).
create policy "Favorites are viewable by everyone"
  on public.favorites for select
  using (true);

-- Authenticated users may favourite as themselves.
create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

-- Users may remove only their own favourites.
create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- favorite_counts ----------------------------------------------------
-- Counts are public-read. No write policy: direct writes are blocked for
-- everyone; only the SECURITY DEFINER trigger above maintains this table.
create policy "Favorite counts are viewable by everyone"
  on public.favorite_counts for select
  using (true);

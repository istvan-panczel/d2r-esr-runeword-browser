-- 007_loot_filter_content_size.sql
--
-- Raises the size cap of a saved loot filter (loot_filters.content) from 512 KB
-- to 2 MB. Sully's QoL filter, the template most players start from, grew to
-- 537,684 bytes in v0.9.2 (553,637 bytes once the editor writes it back), so a
-- filter started from it could not be saved under the old 524,288-byte cap.
-- Owner decision 2026-11-10.
--
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD — same flow
-- as 001-006. Safe on a populated database: no data changes, only the size check
-- constraint is replaced by a looser one (every existing row already passes it)
-- and the column comment is updated. The table is small; re-adding the
-- constraint validates the rows under a brief lock. Safe to run twice
-- (`drop constraint if exists`).
--
-- Apply it BEFORE deploying the app change: the new client lets files of up to
-- 2 MB through (FILTER_CONTENT_MAX_BYTES), and against the old constraint such a
-- save fails with a check violation instead of the app's own message.
--
-- The 512 KB limit lived only in 005's loot_filters_content_size constraint and
-- the column comment: no trigger, function, RPC or history table copies or
-- measures `content`.
--
-- Contents:
--   1. loot_filters — content size constraint and column comment

-- =====================================================================
-- 1. loot_filters — content size constraint and column comment
-- =====================================================================

alter table public.loot_filters
  drop constraint if exists loot_filters_content_size;

alter table public.loot_filters
  add constraint loot_filters_content_size check (octet_length(content) between 1 and 2097152);

comment on column public.loot_filters.content is 'The filter file as saved (JSON with optional comments), up to 2 MB.';

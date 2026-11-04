-- 006_build_data_size.sql
--
-- Caps the size of builds.build_data and requires it to be a JSON object. Build
-- variants and alternative items (FEATURE-BUILD-SHARING.md) can make a build's
-- JSON much larger than before.
--
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD — same flow
-- as 001-005. Additive and safe on a populated database: no data changes, only two
-- check constraints. Existing rows are validated when the constraints are added;
-- they pass (PROD's largest build_data was ~15 KB on 2026-11-04), the table is
-- small and the validation takes only a brief lock. Safe to apply to PROD before
-- the deploy, because current clients never write anything near the cap.
--
-- Why 2 MiB: the app refuses to save more than 1 MiB of JSON.stringify bytes
-- (BUILD_DATA_MAX_BYTES). jsonb::text adds a space after every ':' and ',', so
-- the same data measures larger here. The DB cap is a backstop above the app cap,
-- not the limit users hit.
--
-- Contents:
--   1. builds — build_data size and shape constraints

-- =====================================================================
-- 1. builds — build_data size and shape constraints
-- =====================================================================

alter table public.builds
  add constraint builds_build_data_size check (octet_length(build_data::text) <= 2097152),
  add constraint builds_build_data_object check (jsonb_typeof(build_data) = 'object');

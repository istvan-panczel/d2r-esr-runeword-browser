-- 003_harden_write_access.sql
--
-- Hardening pass on top of 001/002 (both already applied to DEV + PROD).
-- Apply manually via the Supabase SQL Editor to DEV first, then PROD — same flow
-- as the earlier migrations. Safe to run on a populated database: no data changes,
-- only privilege/function definitions.
--
-- Why: RLS already restricts which *rows* a client may write (owner-only), but RLS
-- cannot restrict which *columns* are written. Without column scoping, an
-- authenticated owner could PATCH/POST their own rows with arbitrary values for
-- trigger-managed / immutable columns (e.g. likes_count, created_at, avatar_url)
-- via the auto-generated REST API. These grants close that gap.
--
-- Contents:
--   1. builds   — column-scoped INSERT/UPDATE grants for the API roles.
--   2. profiles — column-scoped UPDATE grant for the API roles.
--   3. handle_new_user() — trim + clamp the OAuth-derived display_name.
--
-- The SECURITY DEFINER triggers (handle_likes_change / handle_favorites_change /
-- extensions.moddatetime / handle_new_user) run as the function owner, not as the
-- API roles, so they are unaffected by these grants and keep maintaining
-- likes_count / favorite_counts / updated_at / the profile row as before.

-- =====================================================================
-- 1. builds — column-scoped write access for the client roles
-- =====================================================================

-- Drop the table-wide INSERT/UPDATE that the Supabase defaults grant to the API
-- roles, then re-grant only the user-writable columns to `authenticated`. `anon`
-- gets no write access restored (RLS already blocked it; this removes the
-- privilege as defence in depth). SELECT and DELETE grants are left untouched.
revoke insert, update on public.builds from anon, authenticated;

-- Insertable columns: everything the create flow legitimately sets. id,
-- likes_count, created_at and updated_at are omitted so they fall back to their
-- column defaults / triggers and cannot be spoofed by the client.
grant insert (user_id, name, description, class, build_data, esr_version, esr_version_updated)
  on public.builds to authenticated;

-- Updatable columns: only the build content an owner edits. user_id (ownership),
-- esr_version (immutable "created on" version), likes_count, created_at and
-- updated_at are intentionally excluded.
grant update (name, description, class, build_data, esr_version_updated)
  on public.builds to authenticated;

-- =====================================================================
-- 2. profiles — column-scoped update access for the client roles
-- =====================================================================

-- Profiles are created by handle_new_user() (SECURITY DEFINER), never by clients,
-- so no INSERT grant is restored. Clients may only change the public display tag
-- and record consent; avatar_url, the discriminator-paired id, and the timestamps
-- become non-writable from the browser. avatar_url stays sourced from Discord
-- metadata only, closing the "set an arbitrary external image URL shown to other
-- users" vector.
revoke insert, update on public.profiles from anon, authenticated;

grant update (display_name, discriminator, privacy_policy_accepted_at)
  on public.profiles to authenticated;

-- =====================================================================
-- 3. handle_new_user — clamp the provider-supplied display name
-- =====================================================================

-- Replaces the 001 definition. The display_name went straight from OAuth metadata
-- into a column constrained to 1..50 chars; an over-long or blank provider name
-- would raise inside the trigger and roll back the whole auth.users insert,
-- failing signup opaquely. Now we trim, drop blanks (fall back to 'Adventurer'),
-- and clamp to 50 chars so the insert always satisfies the constraint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text;
begin
  raw_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'user_name'), ''),
    'Adventurer'
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(raw_name, 50), new.raw_user_meta_data->>'avatar_url');

  return new;
end;
$$;

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabaseConfig } from './config';

/**
 * Singleton Supabase client, or `null` when the env vars are absent (e.g. a
 * contributor running the app without a backend). In that case the build-sharing
 * feature is hidden entirely and the rest of the app works normally.
 *
 * This module pulls in @supabase/supabase-js, so it is only imported by the
 * (lazy-loaded) auth/builds sagas — never by the eager app shell. Eager code
 * should use `isSupabaseConfigured` from ./config instead.
 *
 * The anon/publishable key is public by design — it ships in the browser bundle
 * and Row Level Security handles authorization.
 */
export const supabase: SupabaseClient<Database> | null = supabaseConfig
  ? createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Parse the session out of the OAuth / magic-link redirect URL on load.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the Supabase client, throwing if it is not configured. Use only in
 * code paths that run behind the feature gate (sagas reached after an
 * `isSupabaseConfigured` check), so the throw is never hit in normal operation.
 */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing).');
  }
  return supabase;
}

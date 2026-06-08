// Lightweight Supabase configuration check. Deliberately does NOT import
// @supabase/supabase-js, so eager consumers (the store, startup, the header)
// can ask "is the feature enabled?" without pulling the SDK into the main
// bundle. The heavy client lives in ./client and is only loaded by the
// (lazy) auth/builds sagas.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Raw client config, or null when the env vars are absent. Consumed by ./client. */
export const supabaseConfig: { readonly url: string; readonly anonKey: string } | null = url && anonKey ? { url, anonKey } : null;

/** Whether the build-sharing feature is enabled (both Supabase env vars present). */
export const isSupabaseConfigured: boolean = supabaseConfig !== null;

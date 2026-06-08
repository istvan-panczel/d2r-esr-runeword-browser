/// <reference types="vite/client" />

// Augments Vite's built-in ImportMetaEnv with this app's custom variables.
// Both are optional: when absent, the build-sharing feature is hidden and the
// rest of the app works normally (see src/core/supabase/client.ts).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

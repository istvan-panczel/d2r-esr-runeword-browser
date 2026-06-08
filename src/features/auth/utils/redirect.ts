const AUTH_RETURN_KEY = 'd2r-auth-return-to';

/**
 * Absolute URL Supabase redirects back to after OAuth / magic-link. Points at the
 * app root (respecting Vite's BASE_URL for the GitHub Pages sub-path). The actual
 * in-app destination is restored separately from `takeAuthReturnTo()`.
 */
export function authRedirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

/** Remembers the in-app location (router path, no basename) to return to after sign-in. */
export function storeAuthReturnTo(pathWithSearch: string): void {
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, pathWithSearch);
  } catch {
    // sessionStorage unavailable (private mode, etc.) — return-to is best-effort.
  }
}

/** Reads and clears the stored return location. Returns null when none is set. */
export function takeAuthReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(AUTH_RETURN_KEY);
    if (value !== null) sessionStorage.removeItem(AUTH_RETURN_KEY);
    return value;
  } catch {
    return null;
  }
}

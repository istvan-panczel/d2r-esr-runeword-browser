/** The only host whose avatar images the app loads: Discord's CDN (Discord sign-ins fill `avatar_url` from it). */
const AVATAR_HOST = 'cdn.discordapp.com';

/**
 * The profile avatar URL to render, or null. Email sign-ups control their own `avatar_url` (user metadata), so an
 * arbitrary URL would make every viewer's browser request an outside server that sees their IP; only Discord CDN
 * images are shown, anything else falls back to the initials.
 */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (url === null || url === undefined) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === AVATAR_HOST ? parsed.href : null;
  } catch {
    return null;
  }
}

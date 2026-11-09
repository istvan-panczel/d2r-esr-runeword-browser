/**
 * The old `/game-data/...` page URLs (splat after `/game-data/`, lower case) and where each page lives now. The Game Data
 * pages became top-level URLs, so shared Copy Link URLs and bookmarks still arrive here. `''` is the bare `/game-data`.
 */
const MOVED_GAME_DATA_PAGES: ReadonlyMap<string, string> = new Map([
  ['', '/bases'],
  ['bases', '/bases'],
  ['sets', '/sets'],
  ['best-base', '/best-base'],
  ['affixes', '/affixes'],
  ['types', '/item-types'],
  ['enhance', '/enhance'],
  ['cube', '/cube-recipes'],
  ['materials', '/materials'],
  ['areas', '/area-levels'],
]);

/**
 * Where an old `/game-data/<splat>` URL goes, with the same query and hash (they carry the shared filters), or null when
 * it was never a page (the normal not-found page). `search` and `hash` are `location.search` / `location.hash`. Matches
 * like the router did: case-insensitive, trailing slashes ignored.
 */
export function gameDataRedirectTarget(splat: string, search = '', hash = ''): string | null {
  const target = MOVED_GAME_DATA_PAGES.get(splat.replace(/\/+$/, '').toLowerCase());
  return target === undefined ? null : `${target}${search}${hash}`;
}

/**
 * Routes that render from static bundles only (no HTM/Dexie data), so AppLayout skips both startup gates for them: the
 * loading spinner and the fatal sync-error screen. See docs/technical/NAVIGATION.md "Startup loading gate".
 */

/** Matched exactly: the home page (`/`) would prefix-match every path. */
const STATIC_BUNDLE_EXACT_ROUTES: readonly string[] = ['/'];

/** Matched with their child paths. */
const STATIC_BUNDLE_ROUTE_PREFIXES: readonly string[] = [
  '/guide',
  '/loot-filters',
  '/enhance',
  '/cube-recipes',
  '/materials',
  '/sets',
  '/area-levels',
  // Only the old-URL redirect lives here and it needs no data: the page it lands on applies its own gate.
  '/game-data',
  '/campaign-map',
  '/stash',
  '/terror-zones',
  '/modifiers',
  '/specializations',
  '/weapon-masteries',
  '/mercenaries',
  '/kill-ledger',
  '/elixirs',
];

export function isStaticBundlePath(pathname: string): boolean {
  if (STATIC_BUNDLE_EXACT_ROUTES.includes(pathname)) return true;
  return STATIC_BUNDLE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

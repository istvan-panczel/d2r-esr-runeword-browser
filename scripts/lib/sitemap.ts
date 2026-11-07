/**
 * public/sitemap.xml: the static routes plus one URL per guide note. Written by `npm run guide:generate` (checked by
 * guide:check) so new notes land in the sitemap without a hand edit. No <lastmod>: the output stays deterministic.
 *
 * Left out on purpose: routes that need sign-in or point at user data (/builds/new, /builds/:id/edit, /build/:id,
 * /user/:id, /loot-filters/:id; the public /builds list is included), /game-data (it only redirects to /game-data/bases)
 * and /guide/map (it only redirects to /guide).
 */
export const SITE_URL = 'https://istvan-panczel.github.io/d2r-esr-runeword-browser/';

interface SitemapEntry {
  readonly path: string;
  readonly changefreq: 'weekly' | 'monthly';
  readonly priority: string;
}

/** Static routes, in output order; the guide notes follow /guide (/guide/map only redirects there now). */
const ROUTES_BEFORE_NOTES: readonly SitemapEntry[] = [
  { path: '', changefreq: 'weekly', priority: '1.0' },
  { path: 'guide', changefreq: 'weekly', priority: '0.9' },
];

const NOTE_ENTRY: Omit<SitemapEntry, 'path'> = { changefreq: 'weekly', priority: '0.7' };

const ROUTES_AFTER_NOTES: readonly SitemapEntry[] = [
  { path: 'runewords', changefreq: 'weekly', priority: '0.9' },
  { path: 'gemwords', changefreq: 'weekly', priority: '0.9' },
  { path: 'socketables', changefreq: 'weekly', priority: '0.8' },
  { path: 'uniques', changefreq: 'weekly', priority: '0.8' },
  { path: 'mythicals', changefreq: 'weekly', priority: '0.8' },
  { path: 'ascendancies', changefreq: 'weekly', priority: '0.8' },
  { path: 'skills', changefreq: 'monthly', priority: '0.7' },
  { path: 'modifiers', changefreq: 'monthly', priority: '0.7' },
  { path: 'builds', changefreq: 'weekly', priority: '0.7' },
  { path: 'game-data/bases', changefreq: 'monthly', priority: '0.7' },
  { path: 'game-data/sets', changefreq: 'monthly', priority: '0.7' },
  { path: 'game-data/best-base', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/affixes', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/types', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/enhance', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/cube', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/materials', changefreq: 'monthly', priority: '0.6' },
  { path: 'game-data/areas', changefreq: 'monthly', priority: '0.6' },
  { path: 'campaign-map', changefreq: 'monthly', priority: '0.7' },
  { path: 'loot-filters', changefreq: 'monthly', priority: '0.6' },
  { path: 'terror-zones', changefreq: 'monthly', priority: '0.6' },
];

/** Note slugs are sorted so the output does not depend on the bundle's note order. */
export function buildSitemap(noteSlugs: readonly string[]): string {
  const notes = [...noteSlugs].sort().map((slug): SitemapEntry => ({ path: `guide/${encodeURIComponent(slug)}`, ...NOTE_ENTRY }));
  const entries = [...ROUTES_BEFORE_NOTES, ...notes, ...ROUTES_AFTER_NOTES];
  const urls = entries.map(
    ({ path, changefreq, priority }) =>
      `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('')}</urlset>\n`;
}

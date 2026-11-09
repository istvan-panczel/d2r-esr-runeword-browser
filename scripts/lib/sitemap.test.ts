import { describe, it, expect } from 'vitest';
import { buildSitemap, SITE_URL } from './sitemap.ts';

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => (match[1] ?? '').replace(SITE_URL, '/'));
}

describe('buildSitemap', () => {
  it('lists the static routes with the notes sorted after /guide', () => {
    const paths = locs(buildSitemap(['start-here', 'glossary']));
    expect(paths.slice(0, 4)).toEqual(['/', '/guide', '/guide/glossary', '/guide/start-here']);
    expect(paths).not.toContain('/guide/map');
    expect(paths).toContain('/runewords');
    expect(paths).toContain('/loot-filters');
    expect(paths).toContain('/bases');
  });

  it('leaves out sign-in, user-data and redirect-only routes', () => {
    const paths = locs(buildSitemap([]));
    for (const path of paths) expect(path).not.toMatch(/^\/(builds\/|build\/|user\/|loot-filters\/)|^\/game-data$/);
  });

  it('is deterministic and well formed', () => {
    const xml = buildSitemap(['b', 'a']);
    expect(xml).toBe(buildSitemap(['a', 'b']));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
    expect(xml.endsWith('</urlset>\n')).toBe(true);
  });
});

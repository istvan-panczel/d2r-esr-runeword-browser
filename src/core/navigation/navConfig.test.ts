import { isValidElement } from 'react';
import { matchRoutes, Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { router } from '@/core/router';
import {
  COMMUNITY_TOOLS,
  ESR_REPO_URL,
  ESR_WIKI_OVERLAY_NOTE_URL,
  NAV_ENTRIES,
  OFFICIAL_LINKS,
  getActiveNavGroup,
  getActiveNavItem,
  getAllNavItems,
  getNavEntries,
  isNavGroupActive,
  isNavItemActive,
  type NavGroup,
} from './navConfig';

const items = getAllNavItems();
const homeLinkPaths = NAV_ENTRIES.flatMap((entry) => (entry.kind === 'link' ? (entry.homeLinks ?? []).map((link) => link.to) : []));

describe('navConfig', () => {
  it.each([...items.map((item) => item.to), ...homeLinkPaths].map((to) => [to] as const))(
    '%s resolves to a real route (not the catch-all)',
    (path) => {
      const matches = matchRoutes(router.routes, path);
      expect(matches).not.toBeNull();
      const deepest = matches?.at(-1);
      expect(deepest?.route.path).not.toBe('*');
    }
  );

  it('has unique labels and keys across groups and items', () => {
    const groups = NAV_ENTRIES.filter((e): e is NavGroup => e.kind === 'group');
    const labels = [...groups.map((g) => g.label), ...items.map((i) => i.label)];
    expect(new Set(labels).size).toBe(labels.length);
    const keys = [...groups.map((g) => g.key), ...items.map((i) => i.key)];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('detects an unknown path (sanity check of the route matcher)', () => {
    expect(matchRoutes(router.routes, '/no-such-page')?.at(-1)?.route.path).toBe('*');
  });

  it('has unique paths and a description for every item', () => {
    expect(new Set(items.map((i) => i.to)).size).toBe(items.length);
    for (const item of items) expect(item.description.trim(), item.label).not.toBe('');
  });

  it('hides Builds unless Supabase is configured', () => {
    const labels = (enabled: boolean) => getAllNavItems(getNavEntries(enabled)).map((i) => i.label);
    expect(labels(false)).not.toContain('Builds');
    expect(labels(true)).toContain('Builds');
  });

  it('marks the item and its group active on its own and child paths, never on the home page', () => {
    const itemsGroup = NAV_ENTRIES.find((e): e is NavGroup => e.kind === 'group' && e.key === 'items');
    const recipes = NAV_ENTRIES.find((e): e is NavGroup => e.kind === 'group' && e.key === 'recipes');
    if (!itemsGroup || !recipes) throw new Error('missing group');
    expect(isNavGroupActive('/bases', itemsGroup)).toBe(true);
    expect(isNavGroupActive('/cube-recipes', itemsGroup)).toBe(false);
    expect(isNavGroupActive('/guide', recipes)).toBe(false);
    expect(isNavGroupActive('/runewords', recipes)).toBe(true);
    expect(isNavGroupActive('/', recipes)).toBe(false);
    const runewords = recipes.items[0];
    expect(isNavItemActive('/gemwords', runewords)).toBe(false);
    expect(isNavItemActive('/runewordsx', runewords)).toBe(false);
  });

  it('keeps the menu groups and pages in the agreed order', () => {
    const summary = NAV_ENTRIES.map((e) => (e.kind === 'group' ? [e.label, e.items.map((i) => i.label)] : e.item.label));
    expect(summary).toEqual([
      ['Recipes', ['Runewords', 'Gemwords', 'Socketables', 'Best Base', 'Cube Recipes', 'Enhance', 'Materials']],
      ['Items', ['Uniques', 'Mythicals', 'Sets', 'Bases', 'Item Types', 'Affixes', 'Modifiers', 'Elixirs', 'Patch Notes']],
      ['Character', ['Skills', 'Ascendancies', 'Specializations', 'Weapon Masteries', 'Mercenaries', 'Kill Ledger']],
      ['Areas', ['Campaign Map', 'Area Levels', 'Terror Zones']],
      ['My Data', ['My Character', 'Stash Overview', 'Ancient Coupons', 'All Items']],
      'Guide',
      'Builds',
      'Loot Filters',
    ]);
  });

  describe('getActiveNavGroup', () => {
    it('finds the group of a page and of a sub-page', () => {
      expect(getActiveNavGroup('/bases')?.key).toBe('items');
      expect(getActiveNavGroup('/stash/coupons')?.key).toBe('my-data');
      expect(getActiveNavGroup('/character')?.key).toBe('my-data');
      expect(getActiveNavGroup('/area-levels')?.key).toBe('areas');
    });

    it.each(['/', '/guide', '/guide/some-note', '/builds', '/build/abc', '/loot-filters', '/loot-filters/abc', '/no-such-page'])(
      'has no group on %s',
      (path) => {
        expect(getActiveNavGroup(path)).toBeUndefined();
      }
    );
  });

  describe('getActiveNavItem', () => {
    it('finds the menu page, also from a child path', () => {
      expect(getActiveNavItem('/bases')?.label).toBe('Bases');
      expect(getActiveNavItem('/cube-recipes')?.label).toBe('Cube Recipes');
      expect(getActiveNavItem('/area-levels')?.label).toBe('Area Levels');
      expect(getActiveNavItem('/loot-filters/abc')?.label).toBe('Loot Filters');
      expect(getActiveNavItem('/character')?.label).toBe('My Character');
    });

    it('prefers the sub-page over the stash overview and finds nothing off the menu', () => {
      expect(getActiveNavItem('/stash/coupons')?.label).toBe('Ancient Coupons');
      expect(getActiveNavItem('/stash')?.label).toBe('Stash Overview');
      expect(getActiveNavItem('/')).toBeUndefined();
      expect(getActiveNavItem('/nope')).toBeUndefined();
    });
  });

  it('keeps an exact item (the stash overview) inactive on its sibling pages below it', () => {
    const stash = NAV_ENTRIES.find((e): e is NavGroup => e.kind === 'group' && e.key === 'my-data');
    if (!stash) throw new Error('missing group');
    const [character, overview, coupons] = stash.items;
    expect(isNavItemActive('/stash', character)).toBe(false);
    expect(isNavItemActive('/character', character)).toBe(true);
    expect(isNavItemActive('/stash', overview)).toBe(true);
    expect(isNavItemActive('/stash/', overview)).toBe(true);
    expect(isNavItemActive('/stash//', overview)).toBe(true);
    expect(isNavItemActive('/stash/coupons/', coupons)).toBe(true);
    expect(getActiveNavGroup('/stash/')?.key).toBe('my-data');
    expect(getActiveNavGroup('/')).toBeUndefined();
    expect(isNavItemActive('/stash/coupons', overview)).toBe(false);
    expect(isNavItemActive('/stash/coupons', coupons)).toBe(true);
    expect(isNavGroupActive('/stash/coupons', stash)).toBe(true);
    expect(stash.items.map((item) => item.to)).toEqual(['/character', '/stash', '/stash/coupons', '/stash/items']);
    expect(isNavItemActive('/stash/items', overview)).toBe(false);
  });

  it('redirects the old My Stash character page to My Character', () => {
    const element = matchRoutes(router.routes, '/stash/character')?.at(-1)?.route.element;
    expect(isValidElement<{ to: string }>(element) && element.type === Navigate && element.props.to).toBe('/character');
    expect(matchRoutes(router.routes, '/character')?.at(-1)?.route.path).toBe('character');
  });

  it('redirects the old guide note map to the guide overview', () => {
    const element = matchRoutes(router.routes, '/guide/map')?.at(-1)?.route.element;
    expect(isValidElement<{ to: string }>(element) && element.type === Navigate && element.props.to).toBe('/guide');
  });

  describe('OFFICIAL_LINKS', () => {
    it('has unique keys and labels', () => {
      expect(new Set(OFFICIAL_LINKS.map((l) => l.key)).size).toBe(OFFICIAL_LINKS.length);
      expect(new Set(OFFICIAL_LINKS.map((l) => l.label)).size).toBe(OFFICIAL_LINKS.length);
    });

    it.each(OFFICIAL_LINKS.map((link) => [link.key, link] as const))('%s has an https link and a description', (_key, link) => {
      expect(link.href.startsWith('https://')).toBe(true);
      expect(link.description.trim()).not.toBe('');
    });
  });

  describe('COMMUNITY_TOOLS', () => {
    it('has unique keys and labels', () => {
      expect(new Set(COMMUNITY_TOOLS.map((t) => t.key)).size).toBe(COMMUNITY_TOOLS.length);
      expect(new Set(COMMUNITY_TOOLS.map((t) => t.label)).size).toBe(COMMUNITY_TOOLS.length);
    });

    it.each(COMMUNITY_TOOLS.map((tool) => [tool.key, tool] as const))('%s has https links and a description', (_key, tool) => {
      expect(tool.href.startsWith('https://')).toBe(true);
      if (tool.sourceUrl !== undefined) expect(tool.sourceUrl.startsWith('https://')).toBe(true);
      expect(tool.description.trim()).not.toBe('');
      expect(tool.features.length).toBeGreaterThan(0);
      expect(new Set(tool.features).size).toBe(tool.features.length);
    });

    it('gives archives no source link', () => {
      for (const tool of COMMUNITY_TOOLS.filter((t) => t.kind === 'archive')) expect(tool.sourceUrl).toBeUndefined();
    });

    it('links the wiki overlay built into ESR 3.3 to its patch note, the author repository only as the source', () => {
      const overlay = COMMUNITY_TOOLS.find((tool) => tool.key === 'wiki-overlay');
      expect(overlay?.href).toBe(ESR_WIKI_OVERLAY_NOTE_URL);
      expect(overlay?.href.startsWith(`${ESR_REPO_URL}/`)).toBe(true);
      expect(overlay?.sourceUrl).toBe('https://github.com/Thisisnotsully/ESR-Wiki-Overlay');
      expect(overlay?.description).toContain('built into ESR');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { getNavEntries, NAV_ENTRIES, type NavEntry } from '@/core/navigation/navConfig';
import { searchPages } from './pageSearch';

describe('searchPages', () => {
  it('finds a page by its label and links its path', () => {
    expect(searchPages('cube', NAV_ENTRIES)).toEqual([{ name: 'Cube Recipes', href: '/cube-recipes', section: 'Recipes' }]);
  });

  it('ranks like the item results: prefix before word prefix before substring, case-insensitive', () => {
    const entries: readonly NavEntry[] = [
      {
        kind: 'group',
        key: 'g',
        label: 'Group',
        description: '',
        items: [
          { key: 'a', to: '/a', label: 'Stormbase', description: '' },
          { key: 'b', to: '/b', label: 'Best Base', description: '' },
          { key: 'c', to: '/c', label: 'Bases', description: '' },
        ],
      },
    ];
    expect(searchPages('BASE', entries).map((page) => page.name)).toEqual(['Bases', 'Best Base', 'Stormbase']);
  });

  it('includes the plain links, without a section', () => {
    expect(searchPages('guide', NAV_ENTRIES)).toEqual([{ name: 'Guide', href: '/guide', section: null }]);
    expect(searchPages('my character', NAV_ENTRIES).at(0)).toEqual({ name: 'My Character', href: '/character', section: 'My Data' });
  });

  it('leaves Builds out without Supabase', () => {
    expect(searchPages('builds', getNavEntries(false))).toEqual([]);
    expect(searchPages('builds', getNavEntries(true)).map((page) => page.href)).toEqual(['/builds']);
  });

  it('finds the pages of a menu group by the group name, in menu order', () => {
    expect(searchPages('my data', NAV_ENTRIES).map((page) => page.href)).toEqual([
      '/character',
      '/stash',
      '/stash/coupons',
      '/stash/items',
    ]);
    expect(searchPages('stash', NAV_ENTRIES).map((page) => page.href)).toEqual(['/stash']);
  });

  it('ranks group matches below direct label matches and stays within the limit', () => {
    const results = searchPages('recipes', NAV_ENTRIES);
    expect(results.at(0)).toEqual({ name: 'Cube Recipes', href: '/cube-recipes', section: 'Recipes' });
    expect(results.map((page) => page.name).slice(1)).toEqual(['Runewords', 'Gemwords', 'Socketables', 'Best Base', 'Enhance']);
    expect(results).toHaveLength(6);
    expect(searchPages('recipes', NAV_ENTRIES, 2)).toHaveLength(2);
  });

  it('does not list a page twice when it matches by label and by group', () => {
    const results = searchPages('items', NAV_ENTRIES);
    expect(new Set(results.map((page) => page.href)).size).toBe(results.length);
    expect(results.at(0)?.name).toBe('All Items');
  });

  it('returns nothing for an empty query and honours the limit', () => {
    expect(searchPages('  ', NAV_ENTRIES)).toEqual([]);
    expect(searchPages('s', NAV_ENTRIES, 2)).toHaveLength(2);
  });
});

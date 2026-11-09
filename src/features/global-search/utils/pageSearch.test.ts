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
  });

  it('leaves Builds out without Supabase', () => {
    expect(searchPages('builds', getNavEntries(false))).toEqual([]);
    expect(searchPages('builds', getNavEntries(true)).map((page) => page.href)).toEqual(['/builds']);
  });

  it('returns nothing for an empty query and honours the limit', () => {
    expect(searchPages('  ', NAV_ENTRIES)).toEqual([]);
    expect(searchPages('s', NAV_ENTRIES, 2)).toHaveLength(2);
  });
});

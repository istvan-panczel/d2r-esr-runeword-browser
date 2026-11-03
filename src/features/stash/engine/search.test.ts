import { describe, expect, it } from 'vitest';
import { buildItemTypeIndex } from './itemTypes';
import { matchesItemSearch, parseItemSearch, searchText } from './search';

const TYPES = buildItemTypeIndex([
  { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
  { code: 'belt', name: 'Belt', ancestors: ['belt', 'armo'] },
  { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc'] },
  { code: 'tors', name: 'Armor', ancestors: ['tors', 'armo'] },
]);

describe('item search', () => {
  it('splits words and quoted phrases and marks the item type words', () => {
    expect(parseItemSearch('Belts "faster cast"', TYPES)).toEqual([
      { term: 'belts', typeCodes: ['belt'] },
      { term: 'faster cast', typeCodes: null },
    ]);
    expect(parseItemSearch('ring', null)).toEqual([{ term: 'ring', typeCodes: null }]);
  });

  it('matches type words by the type chain and other words as text, every term', () => {
    const ringMail = { text: searchText(['Ring Mail', null, 'Armor']), typeCodes: ['tors', 'armo'] };
    const ring = { text: searchText(['Ring', '+10% Faster Cast Rate']), typeCodes: ['ring', 'misc'] };
    expect(matchesItemSearch(parseItemSearch('ring', TYPES), ring)).toBe(true);
    expect(matchesItemSearch(parseItemSearch('ring', TYPES), ringMail)).toBe(false);
    expect(matchesItemSearch(parseItemSearch('ring "faster cast"', TYPES), ring)).toBe(true);
    expect(matchesItemSearch(parseItemSearch('ring mail', TYPES), ring)).toBe(false);
    expect(matchesItemSearch([], ring)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { buildItemTypeIndex } from './itemTypes';
import { containsWord, matchesItemSearch, parseItemSearch, searchText, withoutBaseName } from './search';

const TYPES = buildItemTypeIndex([
  { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
  { code: 'belt', name: 'Belt', ancestors: ['belt', 'armo'] },
  { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc'] },
  { code: 'rune', name: 'Rune', ancestors: ['rune', 'misc'] },
  { code: 'orb', name: 'Orb', ancestors: ['orb', 'weap'] },
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

  it('matches type words by the type chain or a word of the other text, other words as text, every term', () => {
    const ringMail = { text: searchText(['Ring Mail', null, 'Armor']), typeCodes: ['tors', 'armo'], typeWordText: '' };
    const ring = {
      text: searchText(['Ring', '+10% Faster Cast Rate']),
      typeCodes: ['ring', 'misc'],
      typeWordText: searchText(['+10% Faster Cast Rate']),
    };
    expect(matchesItemSearch(parseItemSearch('ring', TYPES), ring)).toBe(true);
    expect(matchesItemSearch(parseItemSearch('ring', TYPES), ringMail)).toBe(false);
    expect(matchesItemSearch(parseItemSearch('ring "faster cast"', TYPES), ring)).toBe(true);
    expect(matchesItemSearch(parseItemSearch('ring mail', TYPES), ring)).toBe(false);
    expect(matchesItemSearch([], ring)).toBe(true);
    // a socketed rune, a set item named "… Orb", a Ring Mail of a unique named "… Ring"
    const socketed = { text: searchText(['Long Sword', 'Ru Rune']), typeCodes: ['swor'], typeWordText: searchText(['Ru Rune']) };
    expect(matchesItemSearch(parseItemSearch('Ru Rune', TYPES), socketed)).toBe(true);
    const orb = {
      text: searchText(["Milabrega's Orb", 'Small Shield']),
      typeCodes: ['shie'],
      typeWordText: searchText(["Milabrega's Orb"]),
    };
    expect(matchesItemSearch(parseItemSearch("Milabrega's Orb", TYPES), orb)).toBe(true);
    const tinkered = { text: 'tinkering points: 30', typeCodes: ['tors'], typeWordText: 'tinkering points: 30' };
    expect(matchesItemSearch(parseItemSearch('ring', TYPES), tinkered)).toBe(false);
  });

  it('finds words at word starts and cuts the base name out of a name', () => {
    expect(containsWord('stone of jordan ring', 'ring')).toBe(true);
    expect(containsWord('two rings', 'ring')).toBe(true);
    expect(containsWord('tinkering', 'ring')).toBe(false);
    expect(containsWord('anything', '')).toBe(true);
    expect(withoutBaseName('Ring Mail', 'Ring Mail').trim()).toBe('');
    expect(withoutBaseName('Ring Mail of the Fox', 'Ring Mail')).toBe('  of the Fox');
    expect(withoutBaseName('Grim Visor', null)).toBe('Grim Visor');
  });
});

import { describe, expect, it } from 'vitest';
import type { ItemTextBundle } from '@/features/game-data/engine/schema';
import { makeBundle, makeItem } from '../../testing/stashMocks.mock';
import { stashCatalog } from '../catalog';
import { itemDisplayName } from './itemNames';
import { createItemTextContext } from './itemText';

const catalog = stashCatalog(
  makeBundle({
    bases: [
      { code: 'cap', name: 'Cap', type: 'helm' },
      { code: 'rin', name: 'Ring', type: 'ring' },
    ],
    uniques: [{ id: 770, name: "Biggin's Bonnet", code: 'cap' }],
    setItems: [{ id: 3, name: "Civerb's Ward", code: 'cap', set: 'x' }],
    runewords: [{ id: 63086, key: 'Runeword584', name: 'Cow' }],
  })
);
const names: Pick<ItemTextBundle, 'magicPrefixes' | 'magicSuffixes' | 'autoAffixes' | 'rareNames' | 'lowQuality' | 'superior'> = {
  magicPrefixes: [null, 'Shimmering'],
  magicSuffixes: [null, 'of the Fox'],
  autoAffixes: [null],
  rareNames: [null, 'Shell', 'Grim'],
  lowQuality: ['Crude', 'Cracked'],
  superior: 'Superior',
};
const text = createItemTextContext({ ...emptyText(), ...names }, catalog);

function emptyText(): ItemTextBundle {
  return {
    stats: [],
    strings: {},
    skills: [],
    classes: [],
    monsters: [],
    monTypes: [],
    magicPrefixes: [],
    magicSuffixes: [],
    autoAffixes: [],
    rareNames: [],
    lowQuality: [],
    superior: 'Superior',
  };
}

describe('itemDisplayName', () => {
  it('names uniques, set items and runewords from stash.json, with or without the text tables', () => {
    expect(itemDisplayName(makeItem('cap', { quality: 'unique', uniqueId: 770 }), catalog)).toBe("Biggin's Bonnet");
    expect(itemDisplayName(makeItem('cap', { quality: 'set', setId: 3 }), catalog)).toBe("Civerb's Ward");
    expect(itemDisplayName(makeItem('cap', { runewordId: 63086 }), catalog)).toBe('Cow');
  });

  it('names magic, rare, superior, inferior and personalized items with the name tables', () => {
    expect(itemDisplayName(makeItem('rin', { quality: 'magic', prefixIds: [1], suffixIds: [1] }), catalog, text)).toBe(
      'Shimmering Ring of the Fox'
    );
    expect(itemDisplayName(makeItem('rin', { quality: 'magic', prefixIds: [0], suffixIds: [1] }), catalog, text)).toBe('Ring of the Fox');
    expect(itemDisplayName(makeItem('cap', { quality: 'rare', rareNameIds: [2, 1] }), catalog, text)).toBe('Grim Shell');
    expect(itemDisplayName(makeItem('cap', { quality: 'superior', qualityVariant: 3 }), catalog, text)).toBe('Superior Cap');
    expect(itemDisplayName(makeItem('cap', { quality: 'inferior', qualityVariant: 1 }), catalog, text)).toBe('Cracked Cap');
    expect(itemDisplayName(makeItem('cap', { personalizedName: 'Mefi' }), catalog, text)).toBe("Mefi's Cap");
  });

  it('falls back to the base name without the text tables', () => {
    const placeholder = createItemTextContext(null, catalog);
    expect(itemDisplayName(makeItem('cap', { quality: 'rare', rareNameIds: [2, 1] }), catalog, placeholder)).toBe('Cap');
    expect(itemDisplayName(makeItem('rin', { quality: 'magic', prefixIds: [1], suffixIds: [1] }), catalog)).toBe('Ring');
    expect(itemDisplayName(makeItem('zzz'), catalog)).toBe('zzz');
  });
});

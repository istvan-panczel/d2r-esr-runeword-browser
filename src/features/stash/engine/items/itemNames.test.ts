import { describe, expect, it } from 'vitest';
import type { ItemTextBundle } from '@/features/game-data/engine/schema';
import { makeBundle, makeItem } from '../../testing/stashMocks.mock';
import { stashCatalog } from '../catalog';
import { describeStashItem } from '../describeItem';
import { itemDisplayName, itemQuantityLabel } from './itemNames';
import { createItemTextContext } from './itemText';

const catalog = stashCatalog(
  makeBundle({
    bases: [
      { code: 'cap', name: 'Cap', type: 'helm' },
      { code: 'rin', name: 'Ring', type: 'ring' },
      { code: 'cm1', name: 'Small Charm', type: 'scha' },
      { code: 'aqv', name: 'Arrows', type: 'bowq' },
    ],
    uniques: [{ id: 770, name: "Biggin's Bonnet", code: 'cap' }],
    setItems: [{ id: 3, name: "Civerb's Ward", code: 'cap', set: 'x' }],
    runewords: [
      { id: 63086, key: 'Runeword584', name: 'Cow' },
      { id: 10910, key: 'Holy', name: 'Holy', gemword: true },
    ],
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
    bases: {},
    socketables: {},
    levels: { uniques: [], setItems: [], magicPrefixes: [], magicSuffixes: [], autoAffixes: [] },
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

  it('names crafted and tempered items like rares, with the base as the fallback', () => {
    expect(itemDisplayName(makeItem('rin', { quality: 'crafted', rareNameIds: [1, 2] }), catalog, text)).toBe('Shell Grim');
    expect(itemDisplayName(makeItem('rin', { quality: 'tempered', rareNameIds: [2, 9] }), catalog, text)).toBe('Grim');
    expect(itemDisplayName(makeItem('rin', { quality: 'crafted', rareNameIds: [7, 9] }), catalog, text)).toBe('Ring');
  });

  it('names gemword charms and personalized uniques, runewords and rares', () => {
    expect(itemDisplayName(makeItem('cm1', { quality: 'magic', runewordId: 10910 }), catalog, text)).toBe('Holy');
    expect(itemDisplayName(makeItem('cap', { quality: 'unique', uniqueId: 770, personalizedName: 'Mefi' }), catalog)).toBe(
      "Mefi's Biggin's Bonnet"
    );
    expect(itemDisplayName(makeItem('cap', { runewordId: 63086, personalizedName: 'Mefi' }), catalog)).toBe("Mefi's Cow");
    expect(itemDisplayName(makeItem('cap', { quality: 'rare', rareNameIds: [2, 1], personalizedName: 'Mefi' }), catalog, text)).toBe(
      "Mefi's Grim Shell"
    );
  });

  it('takes the description from the caller', () => {
    const item = makeItem('cap', { quality: 'unique', uniqueId: 770 });
    const described = describeStashItem(item, catalog);
    expect(itemDisplayName(item, catalog, null, { ...described, unique: { id: 1, name: 'Other', code: 'cap' } })).toBe('Other');
  });

  it('keeps the base for unknown ids and missing variants', () => {
    expect(itemDisplayName(makeItem('cap', { quality: 'unique', uniqueId: 9999 }), catalog, text)).toBe('Cap');
    expect(itemDisplayName(makeItem('cap', { quality: 'set', setId: 9999 }), catalog, text)).toBe('Cap');
    expect(itemDisplayName(makeItem('cap', { runewordId: 1 }), catalog, text)).toBe('Cap');
    expect(itemDisplayName(makeItem('rin', { quality: 'magic', prefixIds: [5], suffixIds: [0] }), catalog, text)).toBe('Ring');
    expect(itemDisplayName(makeItem('cap', { quality: 'inferior', qualityVariant: null }), catalog, text)).toBe('Cap');
    expect(itemDisplayName(makeItem('cap', { quality: 'inferior', qualityVariant: 1 }), catalog)).toBe('Cap');
    expect(itemDisplayName(makeItem('cap', { quality: 'superior', qualityVariant: 3 }), catalog)).toBe('Superior Cap');
    expect(itemDisplayName(makeItem('cap', { compact: true, quality: null, level: null }), catalog, text)).toBe('Cap');
  });

  it('labels the stack size of quantity items apart from the name', () => {
    expect(itemQuantityLabel(makeItem('aqv', { quantity: 350 }))).toBe('×350');
    expect(itemQuantityLabel(makeItem('aqv', { stackSize: 12 }))).toBe('×12');
    expect(itemQuantityLabel(makeItem('cap'))).toBeNull();
    expect(itemQuantityLabel(makeItem('ppp', { compact: true, stackSize: 0 }))).toBeNull();
  });
});

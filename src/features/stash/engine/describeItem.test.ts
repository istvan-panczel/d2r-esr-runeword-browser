import { describe, expect, it } from 'vitest';
import { STASH_ITEM_FLAGS } from '@/features/game-data/engine/schema';
import { makeBundle, makeItem } from '../testing/stashMocks.mock';
import { stashCatalog } from './catalog';
import { describeStashItem, itemCategory } from './describeItem';
import { buildItemTypeIndex } from './itemTypes';

const BUNDLE = makeBundle({
  items: [
    ['cap', STASH_ITEM_FLAGS.armor, 2, 2],
    ['sbw', STASH_ITEM_FLAGS.weapon, 2, 3],
    ['rin', 0, 1, 1],
    ['cm1', STASH_ITEM_FLAGS.charm, 1, 1],
    ['r01', 0, 1, 1],
  ],
  bases: [
    { code: 'cap', name: 'Cap', type: 'helm', tier: 'normal' },
    { code: 'sbw', name: 'Short Bow', type: 'bow', type2: 'miss' },
    { code: 'rin', name: 'Ring', type: 'ring' },
    { code: 'cm1', name: 'Small Charm', type: 'scha' },
    { code: 'r01', name: 'I Rune', type: 'rune' },
  ],
  uniques: [{ id: 770, name: "Biggin's Bonnet", code: 'cap', coupon: '02c' }],
  setItems: [{ id: 3, name: "Civerb's Ward", code: 'cap', set: "Civerb's Vestments" }],
  sets: [{ id: "Civerb's Vestments", name: "Civerb's Vestments" }],
  runewords: [
    { id: 63086, key: 'Runeword584', name: 'Cow' },
    { id: 10910, key: 'Holy', name: 'Holy', gemword: true },
  ],
});
const TYPES = buildItemTypeIndex([
  { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
  { code: 'helm', name: 'Helm', ancestors: ['helm', 'armo'] },
  { code: 'weap', name: 'Weapon', ancestors: ['weap'] },
  { code: 'bow', name: 'Bow', ancestors: ['bow', 'weap'] },
  { code: 'miss', name: 'Missile Weapon', ancestors: ['miss', 'weap'] },
  { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc'] },
  { code: 'scha', name: 'Small Charm', ancestors: ['scha', 'char', 'misc'] },
  { code: 'rune', name: 'Rune', ancestors: ['rune', 'sock', 'misc'] },
]);
const catalog = stashCatalog(BUNDLE, TYPES);

describe('stashCatalog', () => {
  it('looks up bases, uniques, set items, sets and runewords by the save ids, cached per bundle and types', () => {
    expect(catalog.base('cap')?.name).toBe('Cap');
    expect(catalog.unique(770)?.name).toBe("Biggin's Bonnet");
    expect(catalog.setItem(3)?.set).toBe("Civerb's Vestments");
    expect(catalog.runeword(63086)?.name).toBe('Cow');
    expect(catalog.unique(1)).toBeUndefined();
    expect(catalog.typeChain('sbw')).toEqual(['bow', 'weap', 'miss']);
    expect(catalog.typeChain('zzz')).toEqual([]);
    expect(stashCatalog(BUNDLE, TYPES)).toBe(catalog);
    expect(stashCatalog(BUNDLE).typeChain('sbw')).toEqual([]);
  });
});

describe('describeStashItem', () => {
  it('describes a unique with its row, tier and own icon', () => {
    const described = describeStashItem(makeItem('cap', { quality: 'unique', uniqueId: 770 }), catalog);
    expect(described).toMatchObject({
      kind: 'unique',
      baseName: 'Cap',
      type: 'helm',
      typeName: 'Helm',
      category: 'armor',
      tier: 'normal',
      unique: { id: 770, name: "Biggin's Bonnet" },
      setItem: null,
      runeword: null,
      icon: { kind: 'unique', name: "Biggin's Bonnet", code: 'cap' },
    });
  });

  it('describes a set item with its set, and a runeword over its normal quality', () => {
    expect(describeStashItem(makeItem('cap', { quality: 'set', setId: 3 }), catalog)).toMatchObject({
      kind: 'set',
      setItem: { name: "Civerb's Ward" },
      set: { name: "Civerb's Vestments" },
      icon: { kind: 'set', name: "Civerb's Ward" },
    });
    expect(describeStashItem(makeItem('sbw', { runewordId: 63086, sockets: 2 }), catalog)).toMatchObject({
      kind: 'runeword',
      quality: 'normal',
      category: 'weapon',
      runeword: { name: 'Cow' },
      icon: { kind: 'base', code: 'sbw' },
    });
    expect(describeStashItem(makeItem('cm1', { runewordId: 10910 }), catalog).runeword).toMatchObject({ gemword: true });
  });

  it('describes compact items as simple and misc items with the misc icon', () => {
    expect(describeStashItem(makeItem('r01', { compact: true, quality: null }), catalog)).toMatchObject({
      kind: 'simple',
      category: 'other',
      icon: { kind: 'misc', name: 'I Rune', code: 'r01' },
    });
    expect(describeStashItem(makeItem('rin', { quality: 'rare' }), catalog)).toMatchObject({
      kind: 'rare',
      category: 'jewelry',
      tier: null,
    });
    expect(describeStashItem(makeItem('zzz'), catalog)).toMatchObject({ base: null, baseName: 'zzz', type: null, category: 'other' });
  });

  it('tells the categories apart without types.json from the parser flags and the base type', () => {
    const bare = stashCatalog(BUNDLE);
    expect(describeStashItem(makeItem('sbw'), bare).category).toBe('weapon');
    expect(describeStashItem(makeItem('cm1'), bare).category).toBe('charm');
    expect(describeStashItem(makeItem('rin'), bare).category).toBe('jewelry');
    expect(itemCategory(['jewl', 'sock', 'misc'])).toBe('jewel');
  });
});

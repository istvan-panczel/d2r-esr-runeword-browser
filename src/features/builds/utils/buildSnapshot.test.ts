import { describe, expect, it } from 'vitest';
import type { Affix, Gemword, HtmUniqueItem, Runeword, SocketableBonuses } from '@/core/db';
import {
  compactItems,
  compactNotes,
  freetextRef,
  gemwordToRef,
  itemRefName,
  runewordToRef,
  slotToColumn,
  uniqueToRef,
} from './buildSnapshot';

function affix(rawText: string): Affix {
  return { rawText, pattern: rawText, value: null, valueType: 'none' };
}

const columns: SocketableBonuses = {
  weaponsGloves: [affix('+1 weapon')],
  helmsBoots: [affix('+2 helm')],
  armorShieldsBelts: [affix('+3 armor')],
};

function makeUnique(): HtmUniqueItem {
  return {
    id: 42,
    name: 'Harlequin Crest',
    baseItem: 'Shako',
    baseItemCode: 'uap',
    page: 'armors',
    category: 'Helm',
    itemLevel: 69,
    reqLevel: 62,
    properties: ['+2 to All Skills'],
    isAncientCoupon: false,
    gambleItem: '',
    notes: '',
  };
}

function makeRuneword(): Runeword {
  return {
    name: 'Enigma',
    variant: 1,
    sockets: 3,
    reqLevel: 65,
    sortKey: 0,
    runes: ['Jah', 'Ith', 'Ber'],
    gems: [],
    ingredients: ['Jah', 'Ith', 'Ber'],
    allowedItems: ['Body Armor'],
    excludedItems: [],
    affixes: [],
    columnAffixes: columns,
    tierPointTotals: [],
  };
}

function makeGemword(): Gemword {
  return {
    name: 'Glow',
    variant: 1,
    sockets: 2,
    reqLevel: 20,
    sortKey: 0,
    gems: ['Ruby', 'Ruby'],
    ingredients: ['Ruby', 'Ruby'],
    allowedItems: ['Helm'],
    affixes: [],
    columnAffixes: columns,
  };
}

describe('buildSnapshot', () => {
  it('builds a unique ref with a snapshot', () => {
    const ref = uniqueToRef(makeUnique());
    expect(ref?.type).toBe('unique');
    expect(ref?.id).toBe(42);
    expect(ref?.snapshot.properties).toEqual(['+2 to All Skills']);
  });

  it('returns null for a unique without an id', () => {
    expect(uniqueToRef({ ...makeUnique(), id: undefined })).toBeNull();
  });

  it('builds a runeword ref with column affixes flattened to rawText', () => {
    const ref = runewordToRef(makeRuneword());
    expect(ref.type).toBe('runeword');
    expect(ref.name).toBe('Enigma');
    expect(ref.variant).toBe(1);
    expect(ref.snapshot.runes).toEqual(['Jah', 'Ith', 'Ber']);
    expect(ref.snapshot.columnAffixes.helmsBoots).toEqual(['+2 helm']);
  });

  it('builds a gemword ref', () => {
    const ref = gemwordToRef(makeGemword());
    expect(ref.type).toBe('gemword');
    expect(ref.snapshot.gems).toEqual(['Ruby', 'Ruby']);
    expect(ref.snapshot.columnAffixes.armorShieldsBelts).toEqual(['+3 armor']);
  });

  it('builds a trimmed freetext ref', () => {
    expect(freetextRef('  GG rare gloves  ')).toEqual({ type: 'freetext', name: 'GG rare gloves' });
  });

  it('resolves display names for each item type', () => {
    const unique = uniqueToRef(makeUnique());
    expect(unique).not.toBeNull();
    if (unique !== null) expect(itemRefName(unique)).toBe('Harlequin Crest');
    expect(itemRefName(runewordToRef(makeRuneword()))).toBe('Enigma');
    expect(itemRefName(freetextRef('custom'))).toBe('custom');
  });

  it('compacts an equipment map, dropping empty slots', () => {
    const helmet = runewordToRef(makeRuneword());
    const result = compactItems({ helmet, weapon: null, armor: undefined });
    expect(Object.keys(result)).toEqual(['helmet']);
    expect(result.helmet).toBe(helmet);
  });

  it('compacts notes, trimming text and dropping blank entries', () => {
    const result = compactNotes({ helmet: '  D-Stone until very fast attack speed  ', weapon: '   ', armor: '' });
    expect(result).toEqual({ helmet: 'D-Stone until very fast attack speed' });
  });

  it('maps equipment slots to bonus columns', () => {
    expect(slotToColumn('helmet')).toBe('helmsBoots');
    expect(slotToColumn('boots')).toBe('helmsBoots');
    expect(slotToColumn('weapon')).toBe('weaponsGloves');
    expect(slotToColumn('gloves')).toBe('weaponsGloves');
    expect(slotToColumn('armor')).toBe('armorShieldsBelts');
    expect(slotToColumn('ring1')).toBe('armorShieldsBelts');
  });
});

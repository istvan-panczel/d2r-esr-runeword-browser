import { describe, expect, it } from 'vitest';
import type { BuildData, ItemRef, VariantData } from '../buildData';
import {
  normalizeSlotAlternatives,
  packVariants,
  unpackVariants,
  variantAt,
  variantCount,
  variantHasCrafts,
  variantHasMerc,
  variantHasSkills,
  variantLabel,
} from './buildVariants';

const item = (name: string): ItemRef => ({ type: 'freetext', name });
const forge = { kind: 'forge', forge: 'rune', key: 'r19' } as const;
const meld = { kind: 'meld', material: 'grb', uses: 1 } as const;

const TODAY: BuildData = {
  items: { helmet: item('Shako'), armor: item('Enigma') },
  itemNotes: { helmet: 'Ber socketed' },
  charms: ['Annihilus'],
  skills: '20 Blessed Hammer',
};

describe('unpackVariants / packVariants', () => {
  it('unpacks the top level as the first variant, followed by variants', () => {
    const second: VariantData = { skills: 'Zeal', variantName: 'Melee' };
    const list = unpackVariants({ ...TODAY, variants: [second] });
    expect(list).toEqual([TODAY, second]);
    expect(list[0]).not.toHaveProperty('variants');
  });

  it('round-trips a multi-variant build', () => {
    const build: BuildData = {
      ...TODAY,
      variantName: 'Endgame',
      itemAlternatives: { helmet: [{ ref: item('Circlet'), note: 'Budget' }] },
      variants: [{ items: { armor: item('Fortitude') }, variantName: 'Starter' }, { skills: 'x' }],
    };
    expect(packVariants(unpackVariants(build))).toEqual(build);
  });

  it('saves a single Default variant byte for byte like a build without variants', () => {
    const packed = packVariants([{ ...TODAY, variantName: 'Default' }]);
    expect(JSON.stringify(packed)).toBe(JSON.stringify(TODAY));
    expect(packed).not.toHaveProperty('variants');
    expect(JSON.stringify(packVariants(unpackVariants(TODAY)))).toBe(JSON.stringify(TODAY));
  });

  it('keeps a renamed single variant and the Default name when there are several', () => {
    expect(packVariants([{ ...TODAY, variantName: 'MF' }]).variantName).toBe('MF');
    const packed = packVariants([{ ...TODAY, variantName: 'Default' }, { variantName: 'Other' }]);
    expect(packed.variantName).toBe('Default');
    expect(packed.variants).toEqual([{ variantName: 'Other' }]);
  });

  it('moves the new first variant to the top level when reordered', () => {
    const first: VariantData = { ...TODAY, variantName: 'A' };
    const second: VariantData = { skills: 'Zeal', variantName: 'B' };
    const [a, b] = unpackVariants(packVariants([first, second]));
    const reordered = packVariants([b, a]);
    expect(reordered).toEqual({ ...second, variants: [first] });
    expect(reordered.items).toBeUndefined();
  });

  it('drops nested variants keys and keeps at most nine extra variants', () => {
    const nested = { skills: 'x', variants: [{ skills: 'y' }] } as BuildData;
    const packed = packVariants([nested, nested]);
    expect(packed).toEqual({ skills: 'x', variants: [{ skills: 'x' }] });
    const many = Array.from({ length: 12 }, (_, index) => ({ variantName: `V${String(index)}` }));
    expect(packVariants(many).variants).toHaveLength(9);
  });

  it('packs an empty list to an empty build', () => {
    expect(packVariants([])).toEqual({});
  });

  it('promotes alternatives of empty main slots while packing', () => {
    const packed = packVariants([{ itemAlternatives: { helmet: [{ ref: item('Shako') }] } }]);
    expect(packed).toEqual({ items: { helmet: item('Shako') } });
  });
});

describe('normalizeSlotAlternatives', () => {
  it('returns the same object when every slot with alternatives has a main item', () => {
    const variant: VariantData = { ...TODAY, itemAlternatives: { helmet: [{ ref: item('Circlet') }] } };
    expect(normalizeSlotAlternatives(variant)).toBe(variant);
    expect(normalizeSlotAlternatives(TODAY)).toBe(TODAY);
  });

  it('promotes the first alternative of an empty slot with its note and crafts', () => {
    const variant: VariantData = {
      items: { armor: item('Enigma'), helmet: null },
      itemNotes: { helmet: 'stale note', armor: 'kept' },
      itemCrafts: { helmet: [forge] },
      itemAlternatives: {
        helmet: [
          { ref: item('Shako'), note: 'Ber socketed', crafts: [meld] },
          { ref: item('Circlet'), note: 'Budget' },
        ],
      },
    };
    expect(normalizeSlotAlternatives(variant)).toEqual({
      items: { armor: item('Enigma'), helmet: item('Shako') },
      itemNotes: { helmet: 'Ber socketed', armor: 'kept' },
      itemCrafts: { helmet: [meld] },
      itemAlternatives: { helmet: [{ ref: item('Circlet'), note: 'Budget' }] },
    });
  });

  it('clears the slot note and crafts when the promoted alternative has none', () => {
    const variant: VariantData = {
      weaponSwapNotes: { weapon2: 'old' },
      weaponSwapCrafts: { weapon2: [forge] },
      weaponSwapAlternatives: { weapon2: [{ ref: item('Spirit') }] },
    };
    expect(normalizeSlotAlternatives(variant)).toEqual({ weaponSwap: { weapon2: item('Spirit') } });
  });

  it('works on the mercenary section and drops empty alternative lists and maps', () => {
    const variant: VariantData = {
      mercenary: { helmet: item('Andariel') },
      mercenaryAlternatives: { helmet: [], armor: [{ ref: item('Fortitude'), crafts: [meld] }] },
      itemAlternatives: {},
    };
    expect(normalizeSlotAlternatives(variant)).toEqual({
      mercenary: { helmet: item('Andariel'), armor: item('Fortitude') },
      mercenaryCrafts: { armor: [meld] },
    });
  });
});

describe('variantLabel / variantAt / variantCount', () => {
  it('labels unnamed variants Default and Variant N', () => {
    expect(variantLabel({}, 0)).toBe('Default');
    expect(variantLabel({}, 2)).toBe('Variant 3');
    expect(variantLabel({ variantName: 'MF' }, 0)).toBe('MF');
  });

  it('clamps the index to the build', () => {
    const build: BuildData = { skills: 'A', variants: [{ skills: 'B' }, { skills: 'C' }] };
    expect(variantCount(build)).toBe(3);
    expect(variantCount({})).toBe(1);
    expect(variantAt(build, 1).skills).toBe('B');
    expect(variantAt(build, 9).skills).toBe('C');
    expect(variantAt(build, -1).skills).toBe('A');
    expect(variantAt(build, Number.NaN).skills).toBe('A');
    expect(variantAt(build, 0)).not.toHaveProperty('variants');
    expect(variantAt({ skills: 'only' }, 3).skills).toBe('only');
  });
});

describe('variant gates', () => {
  it('variantHasCrafts sees main and alternative crafts in every section', () => {
    expect(variantHasCrafts({})).toBe(false);
    expect(variantHasCrafts({ itemCrafts: { helmet: [] } })).toBe(false);
    expect(variantHasCrafts({ mercenaryCrafts: { helmet: [forge] } })).toBe(true);
    expect(variantHasCrafts({ weaponSwapAlternatives: { weapon2: [{ ref: item('x') }] } })).toBe(false);
    expect(variantHasCrafts({ weaponSwapAlternatives: { weapon2: [{ ref: item('x'), crafts: [meld] }] } })).toBe(true);
    expect(variantHasCrafts({ itemAlternatives: { ring1: [{ ref: item('x') }, { ref: item('y'), crafts: [forge] }] } })).toBe(true);
  });

  it('variantHasSkills is skill text, a level or an allocation', () => {
    expect(variantHasSkills({})).toBe(false);
    expect(variantHasSkills({ skills: '   ', skillPoints: {} })).toBe(false);
    expect(variantHasSkills({ skills: null })).toBe(false);
    expect(variantHasSkills({ skills: 'Zeal' })).toBe(true);
    expect(variantHasSkills({ level: 90 })).toBe(true);
    expect(variantHasSkills({ skillPoints: { Zeal: 20 } })).toBe(true);
  });

  it('variantHasMerc is an item, an alternative, a note or crafts', () => {
    expect(variantHasMerc({})).toBe(false);
    expect(variantHasMerc({ mercenary: { helmet: null }, mercenaryNotes: { helmet: '  ' }, mercenaryAlternatives: { helmet: [] } })).toBe(
      false
    );
    expect(variantHasMerc({ items: { helmet: item('Shako') } })).toBe(false);
    expect(variantHasMerc({ mercenary: { helmet: item('Andariel') } })).toBe(true);
    expect(variantHasMerc({ mercenaryAlternatives: { helmet: [{ ref: item('Andariel') }] } })).toBe(true);
    expect(variantHasMerc({ mercenaryNotes: { armor: 'Insight' } })).toBe(true);
    expect(variantHasMerc({ mercenaryCrafts: { armor: [forge] } })).toBe(true);
  });
});

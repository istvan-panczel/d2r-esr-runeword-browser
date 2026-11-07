import { buildItemIconIndex, findItemIcon, withoutVariantSuffix } from './useItemIcons';

describe('item icon lookup', () => {
  const axe = { file: 'axe_hand_axe.webp', w: 58, h: 128 };
  const gnasher = { file: 'axe_the_gnasher.webp', w: 60, h: 120 };
  const ward = { file: 'shield_ward.webp', w: 90, h: 100 };
  const viper = { ...ward, name: 'Top of the Horadric Staff' };
  const index = buildItemIconIndex({
    bases: { hax: axe },
    uniques: { 'The Gnasher': gnasher, "Tathamet's Awakening": axe },
    sets: { "Civerb's Ward": ward },
    misc: { 'El Rune': axe, 'Ko Rune#r19': gnasher, 'Ko Rune#r68': ward },
    quest: { vip: viper },
  });

  it('finds bases by code and named items by normalised name', () => {
    expect(findItemIcon(index, { kind: 'base', code: 'hax' })).toBe(axe);
    expect(findItemIcon(index, { kind: 'base', code: 'zzz' })).toBeUndefined();
    expect(findItemIcon(index, { kind: 'unique', name: '  the  GNASHER ' })).toBe(gnasher);
    expect(findItemIcon(index, { kind: 'set', name: 'Civerb’s Ward' })).toBe(ward);
    expect(findItemIcon(index, { kind: 'set', name: 'The Gnasher' })).toBeUndefined();
  });

  it('drops a trailing variant parenthetical, then falls back to the base code', () => {
    expect(withoutVariantSuffix("Tathamet's Awakening (Fire Variant)")).toBe("Tathamet's Awakening");
    expect(findItemIcon(index, { kind: 'unique', name: "Tathamet's Awakening (Cold Variant)" })).toBe(axe);
    expect(findItemIcon(index, { kind: 'unique', name: 'Unknown', code: 'hax' })).toBe(axe);
    expect(findItemIcon(index, { kind: 'unique', name: 'Unknown' })).toBeUndefined();
  });

  it('finds misc items by name, a name keyed per code by its code', () => {
    expect(findItemIcon(index, { kind: 'misc', name: 'el rune' })).toBe(axe);
    expect(findItemIcon(index, { kind: 'misc', name: 'El Rune', code: 'r51' })).toBe(axe);
    expect(findItemIcon(index, { kind: 'misc', name: 'Ko Rune', code: 'r19' })).toBe(gnasher);
    expect(findItemIcon(index, { kind: 'misc', name: 'Ko Rune', code: 'R68' })).toBe(ward);
    // A split name without (or with an unknown) code has no plain entry: no icon rather than the other row's art
    expect(findItemIcon(index, { kind: 'misc', name: 'Ko Rune' })).toBeUndefined();
    expect(findItemIcon(index, { kind: 'misc', name: 'Ko Rune', code: 'r01' })).toBeUndefined();
    expect(findItemIcon(index, { kind: 'misc', name: 'El Rune (12 points)' })).toBe(axe);
    expect(findItemIcon(index, { kind: 'misc', name: 'The Gnasher' })).toBeUndefined();
    // A name without misc art falls back to the base art of the code (rings, charms, jewels)
    expect(findItemIcon(index, { kind: 'misc', name: 'Small Charm', code: 'hax' })).toBe(axe);
    // An icons.json without the misc section
    expect(findItemIcon(buildItemIconIndex({ bases: {}, uniques: {}, sets: {} }), { kind: 'misc', name: 'El Rune' })).toBeUndefined();
  });

  it('finds any item by code (bases, quest items, then the other items) and item types by type code', () => {
    const heart = { file: 'body_part_heart.webp', w: 72, h: 87 };
    const ring = { file: 'ring_ring.webp', w: 87, h: 85 };
    const withCodes = buildItemIconIndex({
      bases: { hax: axe, rin: ring },
      uniques: {},
      sets: {},
      quest: { vip: viper },
      // A 6-pack shares the single item's file
      items: { hrt: heart, '6hrt': heart },
      types: { ring },
    });
    expect(findItemIcon(withCodes, { kind: 'item', code: 'hax' })).toBe(axe);
    expect(findItemIcon(withCodes, { kind: 'item', code: 'vip' })).toBe(viper);
    expect(findItemIcon(withCodes, { kind: 'item', code: '6hrt' })?.file).toBe(heart.file);
    expect(findItemIcon(withCodes, { kind: 'item', code: 'w31' })).toBeUndefined();
    expect(findItemIcon(withCodes, { kind: 'type', code: 'ring' })).toBe(ring);
    // Broad types have no entry
    expect(findItemIcon(withCodes, { kind: 'type', code: 'weap' })).toBeUndefined();
    expect(findItemIcon(index, { kind: 'item', code: 'hrt' })).toBeUndefined();
  });

  it('finds quest items by code only', () => {
    expect(findItemIcon(index, { kind: 'quest', code: 'vip' })).toBe(viper);
    expect(index.quest.get('vip')?.name).toBe('Top of the Horadric Staff');
    expect(findItemIcon(index, { kind: 'quest', code: 'hax' })).toBeUndefined();
    expect(findItemIcon(buildItemIconIndex({ bases: {}, uniques: {}, sets: {} }), { kind: 'quest', code: 'vip' })).toBeUndefined();
  });
});

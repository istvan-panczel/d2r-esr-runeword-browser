import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { parseHtmUniqueItems } from '@/features/data-sync/parsers/htmUniqueItemsParser';
import { parseMythicalUniques } from '@/features/data-sync/parsers/mythicalUniquesParser';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import { parseGemwordsHtml } from '@/features/data-sync/parsers/gemwordsParser';
import type { SetsBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { isKnownMythicalCategory, itemFitsSlot, mythicalSlots, typeSlots, type PickerSlot, type SlotGroup } from './slotFit';

const ALL_SLOTS: readonly PickerSlot[] = [
  'helmet',
  'armor',
  'weapon',
  'shield',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring1',
  'ring2',
  'weapon2',
  'shield2',
];

const slotsFor = (candidate: Parameters<typeof itemFitsSlot>[1]) => ALL_SLOTS.filter((slot) => itemFitsSlot(slot, candidate));

describe('itemFitsSlot', () => {
  it('always allows freetext', () => {
    expect(slotsFor({ type: 'freetext' })).toEqual(ALL_SLOTS);
  });

  it('puts unique helms only in the helmet slot', () => {
    expect(slotsFor({ type: 'unique', category: 'Helm' })).toEqual(['helmet']);
    expect(slotsFor({ type: 'unique', category: 'Primal Helm' })).toEqual(['helmet']);
  });

  it('maps class-specific and LoD jewellery by suffix', () => {
    expect(slotsFor({ type: 'unique', category: 'Sor Ring' })).toEqual(['ring1', 'ring2']);
    expect(slotsFor({ type: 'unique', category: 'LoD Amulet' })).toEqual(['amulet']);
  });

  it('keeps charms and jewels out of every gear slot', () => {
    expect(slotsFor({ type: 'unique', category: 'Grand Charm' })).toEqual([]);
    expect(slotsFor({ type: 'unique', category: 'Jewel' })).toEqual([]);
    expect(slotsFor({ type: 'runeword', allowedItems: ['Charm'] })).toEqual([]);
  });

  it('allows one-handed weapons in both hands (incl. swap) and two-handed ones in the main hand only', () => {
    expect(slotsFor({ type: 'unique', category: 'Sword' })).toEqual(['weapon', 'shield', 'weapon2', 'shield2']);
    expect(slotsFor({ type: 'unique', category: 'Bow' })).toEqual(['weapon', 'weapon2']);
  });

  it('treats quivers, necro heads and grimoires as off-hand items', () => {
    for (const category of ['Bow Quiver', 'Voodoo Heads', 'Grimoire', 'Auric Shields']) {
      expect(slotsFor({ type: 'unique', category })).toEqual(['shield', 'shield2']);
    }
  });

  it('maps set item categories like unique categories, incl. the class jewellery types', () => {
    expect(slotsFor({ type: 'set', category: 'Gloves' })).toEqual(['gloves']);
    expect(slotsFor({ type: 'set', category: 'Orb' })).toEqual(['weapon', 'weapon2']);
    for (const category of ['Barbaric Knuckle', "Sorcerer's Band", 'Warlock Sigil']) {
      expect(slotsFor({ type: 'set', category })).toEqual(['ring1', 'ring2']);
    }
    for (const category of ['Holy Pendant', 'Druidic Necklace', "Sorcerer's Talisman", 'Warlock Pendant']) {
      expect(slotsFor({ type: 'set', category })).toEqual(['amulet']);
    }
  });

  it('allows unknown categories everywhere', () => {
    expect(slotsFor({ type: 'unique', category: 'Something New' })).toEqual(ALL_SLOTS);
    expect(slotsFor({ type: 'runeword', allowedItems: ['Something New'] })).toEqual(ALL_SLOTS);
    expect(slotsFor({ type: 'gemword', allowedItems: [] })).toEqual(ALL_SLOTS);
  });

  it('fits a runeword when any allowed item type fits', () => {
    expect(slotsFor({ type: 'runeword', allowedItems: ['Helm', 'Charm'] })).toEqual(['helmet']);
    expect(slotsFor({ type: 'runeword', allowedItems: ['Any Armor'] })).toEqual([
      'helmet',
      'armor',
      'shield',
      'gloves',
      'boots',
      'belt',
      'shield2',
    ]);
    expect(slotsFor({ type: 'gemword', allowedItems: ['Weapon', 'Gloves', 'Missile'] })).toEqual([
      'weapon',
      'shield',
      'gloves',
      'weapon2',
      'shield2',
    ]);
  });

  it('refines mythicals by base item, falling back to the section header', () => {
    expect(slotsFor({ type: 'mythical', category: 'Mythical Unique Jewelry', baseItem: 'Ring' })).toEqual(['ring1', 'ring2']);
    expect(slotsFor({ type: 'mythical', category: 'Mythical Unique Jewelry', baseItem: 'Jewel' })).toEqual([]);
    expect(slotsFor({ type: 'mythical', category: 'Dedicated Drops Mythical Uniques', baseItem: 'Large Charm' })).toEqual([]);
    expect(slotsFor({ type: 'mythical', category: 'Dedicated Drops Mythical Uniques', baseItem: 'Amulet' })).toEqual(['amulet']);
    // Untyped section + unknown base: allowed everywhere.
    expect(slotsFor({ type: 'mythical', category: 'Dedicated Drops Mythical Uniques', baseItem: 'Mythical Death Blade' })).toEqual(
      ALL_SLOTS
    );
    expect(slotsFor({ type: 'mythical', category: 'Mythical Unique Armor', baseItem: 'Mythical Diadem' })).not.toContain('ring1');
  });
});

// ─── Real fixtures ───────────────────────────────────────────────────────────

const fixture = (file: string) => readFileSync(resolve(__dirname, '../../../../test-fixtures', file), 'utf-8');

/** Deliberately not gear: these may map to no slot. Everything else must reach at least one slot. */
const NON_GEAR_TYPES = new Set(['charm', 'small charm', 'large charm', 'grand charm', 'odd charm', 'jewel']);

function unmappedTypes(types: Iterable<string>): string[] {
  const unmapped = new Set<string>();
  for (const type of types) {
    const groups = typeSlots(type);
    if (groups === undefined || (groups.length === 0 && !NON_GEAR_TYPES.has(type.toLowerCase()))) unmapped.add(type);
  }
  return [...unmapped].sort();
}

describe('typeSlots', () => {
  // ESR 3.3 runewords.htm socketable bonus groups name this base as a type ("Weapon (except Staff) / Mythical Arcane
  // Staff"); unknown would make such a group fit every slot
  it('maps the Mythical Arcane Staff (a two-handed staff) to the weapon slot only', () => {
    expect(typeSlots('Mythical Arcane Staff')).toEqual(['weapon']);
  });
});

describe('slot mapping covers the real data', () => {
  it('maps every unique category to a slot (or deliberately to none)', () => {
    const uniques = [
      ...parseHtmUniqueItems(fixture('unique_weapons.htm'), 'weapons'),
      ...parseHtmUniqueItems(fixture('unique_armors.htm'), 'armors'),
      ...parseHtmUniqueItems(fixture('unique_others.htm'), 'other'),
    ];
    expect(uniques.length).toBeGreaterThan(0);
    const unmapped = unmappedTypes(uniques.map((u) => u.category));
    expect(unmapped, `Unmapped unique categories: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('maps every mythical unique', () => {
    const mythicals = parseMythicalUniques(fixture('unique_mythicals.htm'));
    expect(mythicals.length).toBeGreaterThan(0);
    const unknownCategories = [...new Set(mythicals.map((m) => m.category).filter((c) => !isKnownMythicalCategory(c)))].sort();
    expect(unknownCategories, `Unmapped mythical categories: ${unknownCategories.join(', ')}`).toEqual([]);
    // Every mythical that isn't a charm/jewel must reach at least one gear slot.
    const unreachable = mythicals
      .filter((m) => mythicalSlots(m.category, m.baseItem)?.length === 0)
      .filter((m) => !NON_GEAR_TYPES.has(m.baseItem.toLowerCase()))
      .map((m) => `${m.name} (${m.baseItem})`);
    expect(unreachable, `Mythicals with no slot: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('maps every runeword and gemword allowed item type', { timeout: 60_000 }, () => {
    const runewords = parseRunewordsHtml(fixture('runewords.htm'));
    const gemwords = parseGemwordsHtml(fixture('gemwords.htm'));
    expect(runewords.length).toBeGreaterThan(0);
    expect(gemwords.length).toBeGreaterThan(0);
    const unmapped = unmappedTypes([...runewords, ...gemwords].flatMap((r) => r.allowedItems));
    expect(unmapped, `Unmapped runeword/gemword item types: ${unmapped.join(', ')}`).toEqual([]);
  });
});

// ─── Committed sets.json bundle ──────────────────────────────────────────────

const gameData = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', file), 'utf-8')) as T;

/** types.json `bodyLoc` → the slot groups an item of that body location may go in. */
const BODY_LOC_SLOTS: Readonly<Record<string, readonly SlotGroup[]>> = {
  head: ['helmet'],
  tors: ['armor'],
  rarm: ['weapon', 'shield'],
  larm: ['weapon', 'shield'],
  glov: ['gloves'],
  feet: ['boots'],
  belt: ['belt'],
  neck: ['amulet'],
  rrin: ['ring'],
  lrin: ['ring'],
};

describe('slot mapping covers the committed sets bundle', () => {
  const sets = gameData<SetsBundle>('sets.json').sets;
  const types = gameData<TypesBundle>('types.json').types;
  const categories = [...new Set(sets.flatMap((set) => set.items.map((item) => item.category)))].sort();

  it('maps every set item category to at least one slot', () => {
    expect(categories.length).toBeGreaterThan(0);
    const unmapped = categories.filter((category) => (typeSlots(category)?.length ?? 0) === 0);
    expect(unmapped, `Unmapped set item categories: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('agrees with the body location of each category in types.json', () => {
    const wrong = categories.filter((category) => {
      const bodyLoc = types.find((type) => type.name === category)?.bodyLoc;
      const allowed = bodyLoc !== undefined && bodyLoc !== null ? BODY_LOC_SLOTS[bodyLoc] : undefined;
      if (allowed === undefined) return false;
      return !(typeSlots(category) ?? []).every((group) => allowed.includes(group));
    });
    expect(wrong, `Set item categories mapped against their bodyLoc: ${wrong.join(', ')}`).toEqual([]);
  });
});

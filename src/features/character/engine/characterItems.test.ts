import { describe, expect, it } from 'vitest';
import { makeBundle, makeItem } from '@/features/stash/testing/stashMocks.mock';
import { stashCatalog } from '@/features/stash/engine/catalog';
import { createItemTextContext } from '@/features/stash/engine/items/itemText';
import type { StashItem } from '@/features/stash/parser/types';
import { buildSave, testData } from '../parser/testCharacter';
import { parseCharacter } from '../parser/parseCharacter';
import { equippedGear } from '../parser/location';
import type { CharacterFile, CharacterItem, ItemLocation } from '../parser/types';
import { buildCharacterItems } from './characterItems';

const catalog = stashCatalog(makeBundle({ bases: [] }));
const ctx = createItemTextContext(null, catalog);

const at = (location: ItemLocation, fields: Partial<StashItem> = {}, code = 'xlm'): CharacterItem => ({
  ...makeItem(code, fields),
  location,
  socketed: [],
});

function character(items: CharacterItem[], overrides: Partial<CharacterFile> = {}): CharacterFile {
  const file = parseCharacter(buildSave(), testData);
  return {
    ...file,
    ...overrides,
    items: { ...file.items, player: items, ...overrides.items },
    gear: equippedGear(items),
  };
}

const view = (file: CharacterFile) => buildCharacterItems(file, catalog, ctx);

describe('character items view', () => {
  it('fills the slots and shows weapon set I and II apart', () => {
    const head = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const setOne = at({ kind: 'equipped', slot: 'rightHand', weaponSet: 1, rawBody: 4 });
    const setTwo = at({ kind: 'equipped', slot: 'rightHand', weaponSet: 2, rawBody: 11 });
    const { gear } = view(character([head, setOne, setTwo], { activeWeapon: 1 }));
    expect(gear.map((group) => group.title)).toEqual(['Equipped', 'Weapon set I', 'Weapon set II']);
    expect(gear[0]?.slots.find((slot) => slot.key === 'head')?.row?.item).toMatchObject({ code: 'xlm' });
    expect(gear[0]?.slots.find((slot) => slot.key === 'torso')?.row).toBeNull();
    expect(gear.map((group) => group.active)).toEqual([false, false, true]);
    expect(gear[1]?.slots[0]?.row).not.toBeNull();
    expect(gear[2]?.slots[1]?.row).toBeNull();
  });

  it('puts stored items in the place order, sorted by the grid, with their place', () => {
    const charm = (x: number, y: number) => at({ kind: 'charm', x, y }, { x, y });
    const belt = at({ kind: 'belt', slot: 3 }, { x: 3 });
    const inventory = at({ kind: 'inventory', x: 0, y: 0 });
    const { sections } = view(character([belt, charm(2, 1), charm(0, 1), charm(5, 0), inventory]));
    expect(sections.map((section) => section.title)).toEqual(['Charm Inventory', 'Inventory', 'Belt']);
    expect(sections[0]?.rows.map((row) => row.where)).toEqual(['Row 1, col 6', 'Row 2, col 1', 'Row 2, col 3']);
    expect(sections[2]?.rows[0]?.where).toBe('Slot 4');
  });

  it('does not lose what no list shows', () => {
    const cursor = at({ kind: 'cursor' });
    const corpse = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const file = character([cursor], {
      items: { player: [cursor], corpses: [{ headerBytes: new Uint8Array(12), items: [corpse] }], merc: [], golem: at({ kind: 'cursor' }) },
    });
    const { sections } = view(file);
    expect(sections.map((section) => section.title)).toEqual(['Other items', 'On the corpse', 'Golem item']);
  });

  it('has no mercenary section without a hired merc, and only the worn slots with one', () => {
    expect(view(character([], { mercenary: null })).mercenary).toBeNull();
    const head = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const merc = { dead: false, flags: 0, seed: 1, nameIndex: 0, typeId: 0, experience: 0 };
    const result = view(character([], { mercenary: merc, mercGear: equippedGear([head]) })).mercenary;
    expect(result?.gear[0]?.slots.map((slot) => slot.key)).toEqual(['head']);
  });
});

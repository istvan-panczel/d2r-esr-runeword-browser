import { describe, expect, it } from 'vitest';
import { makeBundle, makeItem } from '@/features/stash/testing/stashMocks.mock';
import { stashCatalog } from '@/features/stash/engine/catalog';
import { createItemTextContext } from '@/features/stash/engine/items/itemText';
import type { StashItem } from '@/features/stash/parser/types';
import { buildSave, testData } from '../parser/testCharacter';
import { parseCharacter } from '../parser/parseCharacter';
import { equippedGear } from '../parser/location';
import type { CharacterFile, CharacterItem, ItemLocation } from '../parser/types';
import type { ItemRow } from '@/features/stash/engine/items/allItems';
import { ascendancyOfStone, buildCharacterItems } from './characterItems';

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
  it('fills the worn slots and shows weapon set I and II apart, the active one marked', () => {
    const head = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const setOne = at({ kind: 'equipped', slot: 'rightHand', weaponSet: 1, rawBody: 4 });
    const setTwo = at({ kind: 'equipped', slot: 'rightHand', weaponSet: 2, rawBody: 11 });
    const { worn, weaponSets } = view(character([head, setOne, setTwo], { activeWeapon: 1 }));
    expect(worn.map((slot) => slot.key)).toEqual(['head', 'neck', 'torso', 'gloves', 'belt', 'feet', 'rightRing', 'leftRing']);
    expect(worn.find((slot) => slot.key === 'head')?.row?.item).toMatchObject({ code: 'xlm' });
    expect(worn.find((slot) => slot.key === 'torso')?.row).toBeNull();
    expect(weaponSets.map((set) => [set.title, set.active])).toEqual([
      ['Weapon set I', false],
      ['Weapon set II', true],
    ]);
    expect(weaponSets[0].slots[0].row).not.toBeNull();
    expect(weaponSets[1].slots[1].row).toBeNull();
  });

  it('keeps the Charm Inventory apart and puts stored items in the place order, sorted by the grid, with their place', () => {
    const charm = (x: number, y: number) => at({ kind: 'charm', x, y }, { x, y });
    const belt = at({ kind: 'belt', slot: 3 }, { x: 3 });
    const inventory = at({ kind: 'inventory', x: 0, y: 0 });
    const { charms, storage } = view(character([belt, charm(2, 1), charm(0, 1), charm(5, 0), inventory]));
    expect(charms.map((row) => row.where)).toEqual(['Row 1, col 6', 'Row 2, col 1', 'Row 2, col 3']);
    expect(storage.map((section) => section.title)).toEqual(['Inventory', 'Belt']);
    expect(storage[1]?.rows[0]?.where).toBe('Slot 4');
  });

  it('does not lose what no list shows', () => {
    const cursor = at({ kind: 'cursor' });
    const corpse = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const file = character([cursor], {
      items: { player: [cursor], corpses: [{ headerBytes: new Uint8Array(12), items: [corpse] }], merc: [], golem: at({ kind: 'cursor' }) },
    });
    const { storage } = view(file);
    expect(storage.map((section) => section.title)).toEqual(['Other items', 'On the corpse', 'Golem item']);
  });

  it('has no mercenary without a hired merc, and every merc slot with one', () => {
    expect(view(character([], { mercenary: null })).mercenary).toBeNull();
    const head = at({ kind: 'equipped', slot: 'head', weaponSet: null, rawBody: 1 });
    const merc = { dead: true, flags: 0, seed: 1, nameIndex: 0, typeId: 0, experience: 0 };
    const result = view(character([], { mercenary: merc, mercGear: equippedGear([head]) })).mercenary;
    expect(result?.dead).toBe(true);
    expect(result?.slots).toHaveLength(10);
    expect(result?.slots.filter((slot) => slot.row !== null).map((slot) => slot.key)).toEqual(['head']);
  });

  it('finds the Kill Ledger and the Ascendancy Stone wherever they are, and says whether they are in the Charm Inventory', () => {
    const ledger = at({ kind: 'charm', x: 1, y: 0 }, { x: 1, y: 0 }, 'led');
    const spare = at({ kind: 'inventory', x: 4, y: 2 }, { x: 4, y: 2 }, 'led');
    const stone = at({ kind: 'charm', x: 0, y: 0 }, {}, 'ast');
    const { ledgers, ascendancyStones } = view(character([spare, ledger, stone]));
    expect(ledgers.map((row) => [row.where, row.inCharmInventory])).toEqual([
      ['Charm Inventory, row 1, col 2', true],
      ['Inventory, row 3, col 5', false],
    ]);
    expect(ascendancyStones.map((row) => row.inCharmInventory)).toEqual([true]);
  });
});

describe('ascendancyOfStone', () => {
  const row = (name: string | undefined) =>
    ({ info: { unique: name === undefined ? null : { name } } }) as unknown as Pick<ItemRow, 'info'>;

  it('names the ascendancy of the stone, as the Ascendancies page spells it', () => {
    expect(ascendancyOfStone(row('Battlemage Ascendancy Stone'), ['Battlemage', 'Warden'])).toBe('Battlemage');
    expect(ascendancyOfStone(row('Unknown Ascendancy Stone'), ['Battlemage'])).toBeNull();
    expect(ascendancyOfStone(row(undefined), ['Battlemage'])).toBeNull();
  });
});

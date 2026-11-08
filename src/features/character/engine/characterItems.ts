/**
 * The items of a character as the page shows them: gear by slot (weapon sets apart), the mercenary's gear and the stored
 * item lists, each item as a stash item row with the tooltip text of the All Items page. Player items are rendered at
 * the character's level; the mercenary's and the golem's stay at the per-level rate (the save holds no merc level).
 */
import { buildItemRow, type ItemRow, type ItemTextEngine } from '@/features/stash/engine/items/allItems';
import { renderItemText, type ItemTextContext } from '@/features/stash/engine/items/itemText';
import type { StashCatalog } from '@/features/stash/engine/catalog';
import type { StashLocation } from '@/features/stash/engine/locations';
import type { CharacterFile, CharacterItem, EquippedGear } from '../parser/types';

export interface CharacterItemRow {
  readonly key: string;
  /** Where the item is, in the card's footer ("Head", "Row 2, col 3", "Slot 5") */
  readonly where: string;
  readonly row: ItemRow;
}

export interface GearSlot {
  readonly key: string;
  readonly label: string;
  /** null: nothing in the slot */
  readonly row: ItemRow | null;
}

export interface GearGroup {
  readonly key: string;
  readonly title: string;
  /** The active weapon set in the save */
  readonly active: boolean;
  readonly slots: readonly GearSlot[];
}

export interface ItemSection {
  readonly key: string;
  readonly title: string;
  readonly note?: string;
  readonly rows: readonly CharacterItemRow[];
}

export interface CharacterItemsView {
  readonly gear: readonly GearGroup[];
  /** null: no mercenary was hired */
  readonly mercenary: { readonly dead: boolean; readonly gear: readonly GearGroup[] } | null;
  /** Charm Inventory, inventory, belt, cube, personal stash; then what no other list holds (only when it has items) */
  readonly sections: readonly ItemSection[];
}

/** Item rows need a stash location; the card's footer shows `where` instead */
const NO_STASH_LOCATION: StashLocation = { section: 0, tabType: 'normal', x: 0, y: 0 };

const engineAt = (characterLevel: number | undefined): ItemTextEngine => ({
  render: (item, ctx) => renderItemText(item, ctx, characterLevel === undefined ? {} : { characterLevel }),
  // Stat values only feed the stat filters of All Items
  stats: () => [],
});

const WORN_SLOTS: readonly (readonly [Exclude<keyof EquippedGear, 'weaponSets'>, string])[] = [
  ['head', 'Head'],
  ['neck', 'Amulet'],
  ['torso', 'Body armor'],
  ['gloves', 'Gloves'],
  ['belt', 'Belt'],
  ['feet', 'Boots'],
  ['rightRing', 'Right ring'],
  ['leftRing', 'Left ring'],
];

interface Build {
  readonly toRow: (item: CharacterItem) => ItemRow;
}

function slot(key: string, label: string, item: CharacterItem | null, build: Build): GearSlot {
  return { key, label, row: item === null ? null : build.toRow(item) };
}

function wornSlots(gear: EquippedGear, build: Build): GearSlot[] {
  return WORN_SLOTS.map(([key, label]) => slot(key, label, gear[key], build));
}

function handSlots(gear: EquippedGear, index: 0 | 1, build: Build): GearSlot[] {
  const set = gear.weaponSets[index];
  return [slot('rightHand', 'Right hand', set.rightHand, build), slot('leftHand', 'Left hand', set.leftHand, build)];
}

const storedPlaces: readonly (readonly [string, string, CharacterItem['location']['kind']])[] = [
  ['charm', 'Charm Inventory', 'charm'],
  ['inventory', 'Inventory', 'inventory'],
  ['belt', 'Belt', 'belt'],
  ['cube', 'Horadric Cube', 'cube'],
  ['stash', 'Personal stash', 'stash'],
];

function whereText(item: CharacterItem): string {
  const { location } = item;
  switch (location.kind) {
    case 'belt':
      return `Slot ${String(location.slot + 1)}`;
    case 'inventory':
    case 'cube':
    case 'stash':
    case 'charm':
      return `Row ${String(location.y + 1)}, col ${String(location.x + 1)}`;
    case 'equipped':
      return 'Equipped';
    case 'socketed':
      return 'In a socket';
    case 'ground':
      return 'On the ground';
    case 'cursor':
      return 'On the cursor';
    case 'dropping':
      return 'Being dropped';
    case 'unknown':
      return 'Place not known';
  }
}

const gridOrder = (item: CharacterItem): [number, number] => {
  const { location } = item;
  if (location.kind === 'belt') return [location.slot, 0];
  return location.kind === 'inventory' || location.kind === 'cube' || location.kind === 'stash' || location.kind === 'charm'
    ? [location.y, location.x]
    : [item.index, 0];
};

function byGridOrder(a: CharacterItem, b: CharacterItem): number {
  const [ay, ax] = gridOrder(a);
  const [by, bx] = gridOrder(b);
  return ay - by || ax - bx;
}

const toRows = (items: readonly CharacterItem[], build: Build, key: string): CharacterItemRow[] =>
  items.map((item, index) => ({ key: `${key}:${String(index)}`, where: whereText(item), row: build.toRow(item) }));

/** Everything the page shows of the items, built once per render of the page */
export function buildCharacterItems(character: CharacterFile, catalog: StashCatalog, ctx: ItemTextContext): CharacterItemsView {
  const builder = (level: number | undefined): Build => {
    const engine = engineAt(level);
    return { toRow: (item) => buildItemRow(item, NO_STASH_LOCATION, catalog, ctx, engine) };
  };
  const build = builder(character.level);
  const mercBuild = builder(undefined);
  const activeSet = character.activeWeapon === 0 ? 0 : 1;

  const gear: GearGroup[] = [
    { key: 'worn', title: 'Equipped', active: false, slots: wornSlots(character.gear, build) },
    { key: 'set1', title: 'Weapon set I', active: activeSet === 0, slots: handSlots(character.gear, 0, build) },
    { key: 'set2', title: 'Weapon set II', active: activeSet === 1, slots: handSlots(character.gear, 1, build) },
  ];

  // The merc has one set of hands: its gear stays on set I
  const mercenary =
    character.mercenary === null
      ? null
      : {
          dead: character.mercenary.dead,
          gear: [
            {
              key: 'merc',
              title: 'Mercenary gear',
              active: false,
              // Only what it wears: a merc has few slots, and rows of "Empty" would only be noise
              slots: [...handSlots(character.mercGear, 0, mercBuild), ...wornSlots(character.mercGear, mercBuild)].filter(
                (entry) => entry.row !== null
              ),
            },
          ],
        };

  const stored: ItemSection[] = storedPlaces.map(([key, title, kind]) => ({
    key,
    title,
    rows: toRows(character.items.player.filter((item) => item.location.kind === kind).sort(byGridOrder), build, key),
  }));
  const shownKinds = new Set<string>(['equipped', 'socketed', ...storedPlaces.map(([, , kind]) => kind)]);
  const elsewhere = character.items.player.filter((item) => !shownKinds.has(item.location.kind));
  const extra: ItemSection[] = [
    { key: 'elsewhere', title: 'Other items', rows: toRows(elsewhere, build, 'elsewhere') },
    {
      key: 'corpses',
      title: 'On the corpse',
      rows: toRows(
        character.items.corpses.flatMap((corpse) => corpse.items),
        build,
        'corpses'
      ),
    },
    {
      key: 'golem',
      title: 'Golem item',
      rows: toRows(character.items.golem === null ? [] : [character.items.golem], mercBuild, 'golem'),
    },
  ];
  return { gear, mercenary, sections: [...stored, ...extra].filter((section) => section.rows.length > 0) };
}

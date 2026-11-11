/**
 * The items of a character as the My Character tabs show them: the worn slots and both weapon sets (Gear), the
 * mercenary's slots, the Charm Inventory, the stored item lists (Storage) and the Kill Ledger and an old Ascendancy Stone
 * (Progress), each item as a stash item row with the tooltip text of the All Items page. Player items are rendered at
 * the character's level; the mercenary's and the golem's stay at the per-level rate (the save holds no merc level).
 */
import { buildItemRow, type ItemRow, type ItemTextEngine } from '@/features/stash/engine/items/allItems';
import { renderItemText, type ItemTextContext } from '@/features/stash/engine/items/itemText';
import type { StashCatalog } from '@/features/stash/engine/catalog';
import type { StashLocation } from '@/features/stash/engine/locations';
import type { CharacterFile, CharacterItem, EquippedGear, EquipSlot } from '../parser/types';

/** Charm-inventory items that are not charms */
export const KILL_LEDGER_CODE = 'led';
export const ASCENDANCY_STONE_CODE = 'ast';

export interface CharacterItemRow {
  readonly key: string;
  /** Where the item is, in the card's footer ("Head", "Row 2, col 3", "Slot 5") */
  readonly where: string;
  readonly row: ItemRow;
}

/** An item that only works in the Charm Inventory, with whether it is there */
export interface PlacedItemRow extends CharacterItemRow {
  readonly inCharmInventory: boolean;
}

export interface GearSlot {
  /** The slot; with `weaponSet` (hands only) unique within a character's or a mercenary's gear */
  readonly key: EquipSlot;
  readonly label: string;
  /** null: nothing in the slot */
  readonly row: ItemRow | null;
}

export interface WeaponSetView {
  /** 1 or 2, as the game numbers the sets (I and II) */
  readonly number: 1 | 2;
  readonly title: string;
  /** The active weapon set in the save */
  readonly active: boolean;
  /** Right hand, then left hand */
  readonly slots: readonly [GearSlot, GearSlot];
}

export interface ItemSection {
  readonly key: string;
  readonly title: string;
  readonly note?: string;
  readonly rows: readonly CharacterItemRow[];
}

export interface CharacterItemsView {
  /** Head, amulet, body armor, gloves, belt, boots, right ring, left ring */
  readonly worn: readonly GearSlot[];
  /** Set I, set II */
  readonly weaponSets: readonly [WeaponSetView, WeaponSetView];
  /** null: no mercenary was hired. Every slot (empty ones too); the merc has one set of hands */
  readonly mercenary: { readonly dead: boolean; readonly slots: readonly GearSlot[] } | null;
  /** The Charm Inventory, grid order (charms, the Kill Ledger, the Ascendancy Stone) */
  readonly charms: readonly CharacterItemRow[];
  /** Inventory, belt, cube, personal stash; then what no other list holds. Only lists with items */
  readonly storage: readonly ItemSection[];
  /** Kill Ledgers anywhere on the character (it counts only in the Charm Inventory) */
  readonly ledgers: readonly PlacedItemRow[];
  /** Old Ascendancy Stones anywhere on the character (before ESR 3.3.04; the game turns a held one into the ascendancy panel) */
  readonly ascendancyStones: readonly PlacedItemRow[];
}

/** Item rows need a stash location; the card's footer shows `where` instead */
const NO_STASH_LOCATION: StashLocation = { section: 0, tabType: 'normal', x: 0, y: 0 };

const engineAt = (characterLevel: number | undefined): ItemTextEngine => ({
  render: (item, ctx) => renderItemText(item, ctx, characterLevel === undefined ? {} : { characterLevel }),
  // Stat values only feed the stat filters of All Items
  stats: () => [],
});

export const SLOT_LABELS: Readonly<Record<EquipSlot, string>> = {
  head: 'Head',
  neck: 'Amulet',
  torso: 'Body armor',
  gloves: 'Gloves',
  belt: 'Belt',
  feet: 'Boots',
  rightRing: 'Right ring',
  leftRing: 'Left ring',
  rightHand: 'Right hand',
  leftHand: 'Left hand',
};

const WORN_SLOTS: readonly Exclude<EquipSlot, 'rightHand' | 'leftHand'>[] = [
  'head',
  'neck',
  'torso',
  'gloves',
  'belt',
  'feet',
  'rightRing',
  'leftRing',
];

interface Build {
  readonly toRow: (item: CharacterItem) => ItemRow;
}

function slot(key: EquipSlot, item: CharacterItem | null, build: Build): GearSlot {
  return { key, label: SLOT_LABELS[key], row: item === null ? null : build.toRow(item) };
}

function wornSlots(gear: EquippedGear, build: Build): GearSlot[] {
  return WORN_SLOTS.map((key) => slot(key, gear[key], build));
}

function handSlots(gear: EquippedGear, index: 0 | 1, build: Build): [GearSlot, GearSlot] {
  const set = gear.weaponSets[index];
  return [slot('rightHand', set.rightHand, build), slot('leftHand', set.leftHand, build)];
}

const storedPlaces: readonly (readonly [string, string, CharacterItem['location']['kind']])[] = [
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
      return SLOT_LABELS[location.slot];
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

/** Where an item is, with the list it is in ("Charm Inventory, row 2, col 3") */
function placeText(item: CharacterItem): string {
  const { kind } = item.location;
  const list = kind === 'charm' ? 'Charm Inventory' : (storedPlaces.find(([, , place]) => place === kind)?.[1] ?? null);
  const where = whereText(item);
  return list === null ? where : `${list}, ${where.charAt(0).toLowerCase()}${where.slice(1)}`;
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

/** Everything the tabs show of the items, built once per render of the page */
export function buildCharacterItems(character: CharacterFile, catalog: StashCatalog, ctx: ItemTextContext): CharacterItemsView {
  const builder = (level: number | undefined): Build => {
    const engine = engineAt(level);
    return { toRow: (item) => buildItemRow(item, NO_STASH_LOCATION, catalog, ctx, engine) };
  };
  const build = builder(character.level);
  const mercBuild = builder(undefined);
  const activeSet = character.activeWeapon === 0 ? 0 : 1;
  const player = character.items.player;

  const mercenary =
    character.mercenary === null
      ? null
      : {
          dead: character.mercenary.dead,
          slots: [...handSlots(character.mercGear, 0, mercBuild), ...wornSlots(character.mercGear, mercBuild)],
        };

  const stored: ItemSection[] = storedPlaces.map(([key, title, kind]) => ({
    key,
    title,
    rows: toRows(player.filter((item) => item.location.kind === kind).sort(byGridOrder), build, key),
  }));
  const shownKinds = new Set<string>(['equipped', 'socketed', 'charm', ...storedPlaces.map(([, , kind]) => kind)]);
  const elsewhere = player.filter((item) => !shownKinds.has(item.location.kind));
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

  const withCode = (code: string, key: string): PlacedItemRow[] =>
    player
      .filter((item) => item.code === code)
      .sort(byGridOrder)
      .map((item, index) => ({
        key: `${key}:${String(index)}`,
        where: placeText(item),
        row: build.toRow(item),
        inCharmInventory: item.location.kind === 'charm',
      }));
  return {
    worn: wornSlots(character.gear, build),
    weaponSets: [
      { number: 1, title: 'Weapon set I', active: activeSet === 0, slots: handSlots(character.gear, 0, build) },
      { number: 2, title: 'Weapon set II', active: activeSet === 1, slots: handSlots(character.gear, 1, build) },
    ],
    mercenary,
    charms: toRows(player.filter((item) => item.location.kind === 'charm').sort(byGridOrder), build, 'charm'),
    storage: [...stored, ...extra].filter((section) => section.rows.length > 0),
    ledgers: withCode(KILL_LEDGER_CODE, 'ledger'),
    ascendancyStones: withCode(ASCENDANCY_STONE_CODE, 'ascendancy'),
  };
}

/**
 * Item locations and the weapon-swap normalisation. Header u32 at 0x10 is the active weapon: when it is 1 the file
 * physically swaps the hand slots, so body locations 4/5 hold weapon set II and 11/12 hold set I. VERIFIED: the two
 * SpinToWin fixtures (active 0 and 1) carry the same gear in the two arrangements. Callers read the normalised
 * `weaponSet`; `rawBody` keeps what the file said.
 */
import { ITEM_MODE } from '../../stash/parser/types.ts';
import type { StashItem } from '../../stash/parser/types.ts';
import type { CharacterItem, EquipSlot, EquippedGear, ItemLocation, WeaponSetNumber, WeaponSet } from './types.ts';

/** Vanilla body locations. 4/5 and 11/12 are the hand slots of the two weapon sets. */
const BODY_SLOTS: readonly (EquipSlot | undefined)[] = [
  undefined,
  'head',
  'neck',
  'torso',
  'rightHand',
  'leftHand',
  'rightRing',
  'leftRing',
  'belt',
  'feet',
  'gloves',
  'rightHand',
  'leftHand',
];

const STORE_KINDS: Partial<Record<number, 'inventory' | 'cube' | 'stash' | 'charm'>> = {
  1: 'inventory',
  4: 'cube',
  5: 'stash',
  7: 'charm', // ESR: the 8×8 Charm Inventory, confirmed by an in-game screenshot
};

/** The weapon set a body location holds on a character with the given active weapon. */
function weaponSetOf(body: number, swapped: boolean): WeaponSetNumber | null {
  if (body === 4 || body === 5) return swapped ? 2 : 1;
  if (body === 11 || body === 12) return swapped ? 1 : 2;
  return null;
}

export function locationOf(item: StashItem, swapped: boolean): ItemLocation {
  const unknown: ItemLocation = { kind: 'unknown', mode: item.mode, body: item.bodyLocation, store: item.storePage };
  switch (item.mode) {
    case ITEM_MODE.stored: {
      const kind = STORE_KINDS[item.storePage];
      return kind === undefined ? unknown : { kind, x: item.x, y: item.y };
    }
    case ITEM_MODE.equipped: {
      const slot = BODY_SLOTS[item.bodyLocation];
      if (slot === undefined) return unknown;
      return { kind: 'equipped', slot, weaponSet: weaponSetOf(item.bodyLocation, swapped), rawBody: item.bodyLocation };
    }
    case ITEM_MODE.belt:
      return { kind: 'belt', slot: item.x };
    case ITEM_MODE.socketed:
      return { kind: 'socketed', socket: item.x };
    case ITEM_MODE.ground:
      return { kind: 'ground' };
    case ITEM_MODE.cursor:
      return { kind: 'cursor' };
    case ITEM_MODE.dropping:
      return { kind: 'dropping' };
    default:
      return unknown;
  }
}

/** The "no row" sentinel on quest items' unique id */
export const NO_UNIQUE_ROW = 65535;

/** `swapped` applies to this item only; socketed children stay put. */
export function toCharacterItem(item: StashItem, swapped: boolean): CharacterItem {
  return {
    ...item,
    uniqueId: item.uniqueId === NO_UNIQUE_ROW ? null : item.uniqueId,
    location: locationOf(item, swapped),
    socketed: item.socketed.map((child) => toCharacterItem(child, false)),
  };
}

const EMPTY_SET = (): WeaponSet => ({ rightHand: null, leftHand: null });

/** The equipped items by slot. For the hand slots, weapon set I and II after the normalisation. */
export function equippedGear(items: readonly CharacterItem[]): EquippedGear {
  const gear: EquippedGear = {
    head: null,
    neck: null,
    torso: null,
    rightRing: null,
    leftRing: null,
    belt: null,
    feet: null,
    gloves: null,
    weaponSets: [EMPTY_SET(), EMPTY_SET()],
  };
  for (const item of items) {
    const { location } = item;
    if (location.kind !== 'equipped') continue;
    if (location.slot === 'rightHand' || location.slot === 'leftHand') {
      gear.weaponSets[location.weaponSet === 2 ? 1 : 0][location.slot] = item;
    } else {
      gear[location.slot] = item;
    }
  }
  return gear;
}

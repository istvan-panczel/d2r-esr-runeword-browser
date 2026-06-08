import type { Gemword, HtmUniqueItem, MythicalUnique, Runeword, SocketableBonuses } from '@/core/db';
import type {
  ColumnAffixesSnapshot,
  EquipmentSlot,
  FreetextItemRef,
  GemwordItemRef,
  ItemRef,
  MythicalItemRef,
  RunewordItemRef,
  UniqueItemRef,
  WeaponSwapSlot,
} from '../buildData';

/** Drops empty (null/undefined) slots from an equipment map before saving. */
export function compactItems<K extends string>(items: Partial<Record<K, ItemRef | null>>): Partial<Record<K, ItemRef>> {
  const result: Partial<Record<K, ItemRef>> = {};
  for (const slot of Object.keys(items) as K[]) {
    const ref = items[slot];
    if (ref) result[slot] = ref;
  }
  return result;
}

/** Trims per-slot notes and drops blank entries before saving. */
export function compactNotes<K extends string>(notes: Partial<Record<K, string>>): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const slot of Object.keys(notes) as K[]) {
    const text = notes[slot]?.trim();
    if (text) result[slot] = text;
  }
  return result;
}

function extractColumnAffixes(columns: SocketableBonuses): ColumnAffixesSnapshot {
  return {
    weaponsGloves: columns.weaponsGloves.map((affix) => affix.rawText),
    helmsBoots: columns.helmsBoots.map((affix) => affix.rawText),
    armorShieldsBelts: columns.armorShieldsBelts.map((affix) => affix.rawText),
  };
}

/** Builds a unique item reference + snapshot. Returns null if the item has no id. */
export function uniqueToRef(item: HtmUniqueItem): UniqueItemRef | null {
  if (item.id === undefined) return null;
  return {
    type: 'unique',
    id: item.id,
    snapshot: { name: item.name, baseItem: item.baseItem, category: item.category, reqLevel: item.reqLevel, properties: item.properties },
  };
}

export function mythicalToRef(item: MythicalUnique): MythicalItemRef | null {
  if (item.id === undefined) return null;
  return {
    type: 'mythical',
    id: item.id,
    snapshot: { name: item.name, baseItem: item.baseItem, category: item.category, reqLevel: item.reqLevel, properties: item.properties },
  };
}

export function runewordToRef(item: Runeword): RunewordItemRef {
  return {
    type: 'runeword',
    name: item.name,
    variant: item.variant,
    snapshot: {
      sockets: item.sockets,
      runes: item.runes,
      gems: item.gems,
      allowedItems: item.allowedItems,
      columnAffixes: extractColumnAffixes(item.columnAffixes),
      reqLevel: item.reqLevel,
    },
  };
}

export function gemwordToRef(item: Gemword): GemwordItemRef {
  return {
    type: 'gemword',
    name: item.name,
    variant: item.variant,
    snapshot: {
      sockets: item.sockets,
      gems: item.gems,
      allowedItems: item.allowedItems,
      columnAffixes: extractColumnAffixes(item.columnAffixes),
      reqLevel: item.reqLevel,
    },
  };
}

export function freetextRef(name: string): FreetextItemRef {
  return { type: 'freetext', name: name.trim() };
}

/** Display name for any item reference. */
export function itemRefName(ref: ItemRef): string {
  switch (ref.type) {
    case 'unique':
    case 'mythical':
      return ref.snapshot.name;
    case 'runeword':
    case 'gemword':
    case 'freetext':
      return ref.name;
  }
}

/**
 * Which runeword/gemword bonus column applies to an equipment slot. ESR groups
 * bonuses into weapons+gloves, helms+boots, and armor+shields+belts; amulets and
 * rings (which don't take runewords) fall back to the armor column.
 */
export function slotToColumn(slot: EquipmentSlot | WeaponSwapSlot): keyof ColumnAffixesSnapshot {
  switch (slot) {
    case 'weapon':
    case 'weapon2':
    case 'gloves':
      return 'weaponsGloves';
    case 'helmet':
    case 'boots':
      return 'helmsBoots';
    default:
      return 'armorShieldsBelts';
  }
}

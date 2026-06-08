// Typed structure stored in builds.build_data (jsonb). Each equipment slot holds
// one of the item-reference variants below, or null/absent for an empty slot.
// See builds-feature-docs/FEATURE-BUILD-SHARING.md.

/** Per-column runeword/gemword bonuses, stored as rawText strings. */
export interface ColumnAffixesSnapshot {
  readonly weaponsGloves: readonly string[];
  readonly helmsBoots: readonly string[];
  readonly armorShieldsBelts: readonly string[];
}

/** Snapshot for unique and mythical unique items (same shape for both). */
export interface UniqueSnapshot {
  readonly name: string;
  readonly baseItem: string;
  readonly category: string;
  readonly reqLevel: number;
  readonly properties: readonly string[];
}

export interface RunewordSnapshot {
  readonly sockets: number;
  readonly runes: readonly string[];
  readonly gems: readonly string[];
  readonly allowedItems: readonly string[];
  readonly columnAffixes: ColumnAffixesSnapshot;
  readonly reqLevel: number;
}

export interface GemwordSnapshot {
  readonly sockets: number;
  readonly gems: readonly string[];
  readonly allowedItems: readonly string[];
  readonly columnAffixes: ColumnAffixesSnapshot;
  readonly reqLevel: number;
}

export interface UniqueItemRef {
  readonly type: 'unique';
  readonly id: number;
  readonly snapshot: UniqueSnapshot;
}

export interface MythicalItemRef {
  readonly type: 'mythical';
  readonly id: number;
  readonly snapshot: UniqueSnapshot;
}

export interface RunewordItemRef {
  readonly type: 'runeword';
  readonly name: string;
  readonly variant: number;
  readonly snapshot: RunewordSnapshot;
}

export interface GemwordItemRef {
  readonly type: 'gemword';
  readonly name: string;
  readonly variant: number;
  readonly snapshot: GemwordSnapshot;
}

export interface FreetextItemRef {
  readonly type: 'freetext';
  readonly name: string;
}

export type ItemRef = UniqueItemRef | MythicalItemRef | RunewordItemRef | GemwordItemRef | FreetextItemRef;

export type EquipmentSlot = 'helmet' | 'armor' | 'weapon' | 'shield' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring1' | 'ring2';
export type WeaponSwapSlot = 'weapon2' | 'shield2';

export interface BuildData {
  readonly items?: Partial<Record<EquipmentSlot, ItemRef | null>>;
  readonly weaponSwap?: Partial<Record<WeaponSwapSlot, ItemRef | null>>;
  readonly mercenary?: Partial<Record<EquipmentSlot, ItemRef | null>>;
  // Per-slot crafting/corruption notes (rune-forging, D-Stone, corruption, etc.).
  // Keyed by slot, parallel to the item maps above, so they survive snapshot refresh
  // on edit and persist when the item in a slot is swapped.
  readonly itemNotes?: Partial<Record<EquipmentSlot, string>>;
  readonly weaponSwapNotes?: Partial<Record<WeaponSwapSlot, string>>;
  readonly mercenaryNotes?: Partial<Record<EquipmentSlot, string>>;
  readonly charms?: readonly string[];
  readonly ascendancy?: string | null;
  readonly skills?: string | null;
}

/** Defensive read of the jsonb column into BuildData (we control all writes). */
export function asBuildData(value: unknown): BuildData {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}
